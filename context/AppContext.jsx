"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const AppContext = createContext(null);

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used inside AppProvider");
  }

  return context;
}

export function AppProvider({ children }) {
  const router = useRouter();

  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userRecord, setUserRecord] = useState(null);
  const [membership, setMembership] = useState(null);
  const [organization, setOrganization] = useState(null);

  const [vas, setVas] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3500);
  }

  function clearWorkspaceState() {
    setVas([]);
    setClients([]);
    setProjects([]);
    setInvoices([]);
    setTasks([]);
  }

  async function signOutUser(message = "Session expired. Please login again.") {
    await supabase.auth.signOut();

    setSession(null);
    setUser(null);
    setProfile(null);
    setUserRecord(null);
    setMembership(null);
    setOrganization(null);
    clearWorkspaceState();

    router.push("/login");
  }

  const loadAppData = useCallback(async () => {
    setLoading(true);

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      showToast(sessionError.message, "error");
      setLoading(false);
      return;
    }

    const currentSession = sessionData?.session;

    if (!currentSession) {
      setLoading(false);
      return;
    }

    const authUser = currentSession.user;
    const userId = authUser.id;
    const userEmail = authUser.email || "";

    setSession(currentSession);
    setUser(authUser);

    const [profileResult, userRowResult, membershipResult] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),

      supabase.from("users").select("*").eq("id", userId).maybeSingle(),

      supabase
        .from("memberships")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileResult.error) {
      console.warn("Profile load warning:", profileResult.error.message);
    }

    if (userRowResult.error) {
      console.warn("User row load warning:", userRowResult.error.message);
    }

    if (membershipResult.error) {
      console.warn("Membership load warning:", membershipResult.error.message);
    }

    const profileData = profileResult.data || null;
    const userRowData = userRowResult.data || null;
    const membershipData = membershipResult.data || null;

    const resolvedOrgId =
      membershipData?.organization_id ||
      profileData?.organization_id ||
      userRowData?.organization_id ||
      null;

    const resolvedRole =
      membershipData?.role ||
      profileData?.role ||
      userRowData?.role ||
      authUser.user_metadata?.role ||
      "va";

    const combinedProfile = {
      ...(userRowData || {}),
      ...(profileData || {}),
      id: userId,
      email: profileData?.email || userRowData?.email || userEmail,
      organization_id: resolvedOrgId,
      role: resolvedRole,
    };

    setProfile(combinedProfile);
    setUserRecord(userRowData || null);

    /*
      Important:
      Independent VA can have no membership and no organization.
      So membership is optional now.
    */
    const resolvedMembership =
      membershipData ||
      (resolvedOrgId
        ? {
            user_id: userId,
            organization_id: resolvedOrgId,
            role: resolvedRole,
            status: "active",
            fallback: true,
          }
        : null);

    setMembership(resolvedMembership);

    if (resolvedOrgId) {
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", resolvedOrgId)
        .maybeSingle();

      if (orgError) {
        console.warn("Organization load warning:", orgError.message);
      }

      setOrganization(orgData || null);
    } else {
      setOrganization(null);
    }

    await loadWorkspaceData({
      orgId: resolvedOrgId,
      role: resolvedRole,
      userId,
      userEmail,
    });

    setLoading(false);
  }, []);

async function loadWorkspaceData({
  orgId = null,
  role = "va",
  userId,
  userEmail = "",
}) {
  if (!userId) return;

  const isVA = role === "va";
  const isClient = role === "client";

  const vasQuery = orgId
    ? supabase
        .from("users")
        .select("*")
        .eq("organization_id", orgId)
        .eq("role", "va")
    : Promise.resolve(emptyResult());

  let clientsQuery = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (isVA) {
    clientsQuery = orgId
      ? clientsQuery.or(`user_id.eq.${userId},organization_id.eq.${orgId}`)
      : clientsQuery.eq("user_id", userId);
  } else if (isClient) {
    clientsQuery = userEmail
      ? clientsQuery.or(`user_id.eq.${userId},email.eq.${userEmail}`)
      : clientsQuery.eq("user_id", userId);
  } else if (orgId) {
    clientsQuery = clientsQuery.eq("organization_id", orgId);
  }

  const projectsQuery = isVA
    ? Promise.resolve(emptyResult())
    : orgId
    ? supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
    : Promise.resolve(emptyResult());

  let invoicesQuery = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (isVA) {
    invoicesQuery = invoicesQuery.eq("user_id", userId);
  } else if (isClient) {
    invoicesQuery = invoicesQuery.eq("created_by", userId);
  } else if (orgId) {
    invoicesQuery = invoicesQuery.eq("organization_id", orgId);
  }

  let tasksQuery = supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (isVA) {
    tasksQuery = tasksQuery.eq("assigned_to", userId);
  } else if (isClient) {
    tasksQuery = tasksQuery.eq("created_by", userId);
  } else if (orgId) {
    tasksQuery = tasksQuery.eq("organization_id", orgId);
  }

  const [
    vasResult,
    clientsResult,
    projectsResult,
    invoicesResult,
    tasksResult,
  ] = await Promise.all([
    vasQuery,
    clientsQuery,
    projectsQuery,
    invoicesQuery,
    tasksQuery,
  ]);

  setVas(vasResult.data || []);
  setClients(clientsResult.data || []);
  setProjects(isVA ? [] : projectsResult.data || []);
  setInvoices(invoicesResult.data || []);
  setTasks(tasksResult.data || []);
}

function emptyResult() {
  return {
    data: [],
    error: null,
  };
}

  async function refreshToken() {
    const { data, error } = await supabase.auth.refreshSession();

    if (error || !data?.session) {
      await signOutUser();
      return null;
    }

    setSession(data.session);
    setUser(data.session.user);

    return data.session;
  }

  async function refreshWorkspace() {
    if (!user) return;

    const currentOrgId =
      membership?.organization_id ||
      profile?.organization_id ||
      userRecord?.organization_id ||
      null;

    const currentRole =
      membership?.role || profile?.role || userRecord?.role || "va";

    await loadWorkspaceData({
      orgId: currentOrgId,
      role: currentRole,
      userId: user.id,
      userEmail: user.email || "",
    });
  }

  function getCurrentOrgId() {
    return (
      membership?.organization_id ||
      profile?.organization_id ||
      userRecord?.organization_id ||
      null
    );
  }

  function getCurrentRole() {
    return membership?.role || profile?.role || userRecord?.role || "va";
  }

  async function addProject(payload) {
    if (!user) return;

    const orgId = getCurrentOrgId();

    const { error } = await supabase.from("projects").insert({
      ...payload,
      organization_id: payload.organization_id ?? orgId,
      user_id: payload.user_id ?? user.id,
      created_by: user.id,
      status: payload.status || "active",
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Project created successfully.");
    await refreshWorkspace();
  }

  async function addClient(payload) {
    if (!user) return;

    const orgId = getCurrentOrgId();
    const currentRole = getCurrentRole();

    const { error } = await supabase.from("clients").insert({
      ...payload,
      organization_id: payload.organization_id ?? orgId,
      user_id:
        payload.user_id ??
        (currentRole === "va" || !orgId ? user.id : null),
      status: payload.status || "active",
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Client added successfully.");
    await refreshWorkspace();
  }

  async function addInvoice(payload) {
    if (!user) return;

    const orgId = getCurrentOrgId();
    const currentRole = getCurrentRole();

    const { error } = await supabase.from("invoices").insert({
      ...payload,
      organization_id: payload.organization_id ?? orgId,
      user_id:
        payload.user_id ??
        (currentRole === "va" || !orgId ? user.id : null),
      created_by: user.id,
      status: payload.status || "draft",
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Invoice created successfully.");
    await refreshWorkspace();
  }

  async function addTask(payload) {
    if (!user) return;

    const orgId = getCurrentOrgId();

    const { error } = await supabase.from("tasks").insert({
      ...payload,
      organization_id: payload.organization_id ?? orgId,
      created_by: user.id,
      status: payload.status || "todo",
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Task assigned successfully.");
    await refreshWorkspace();
  }

  useEffect(() => {
    loadAppData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        setProfile(null);
        setUserRecord(null);
        setMembership(null);
        setOrganization(null);
        clearWorkspaceState();
        router.push("/login");
      }

      if (event === "TOKEN_REFRESHED") {
        setSession(nextSession);
        setUser(nextSession?.user || null);
      }

      if (event === "SIGNED_IN") {
        await loadAppData();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadAppData, router]);

  useEffect(() => {
    if (!session?.expires_at) return;

    const expiresAt = session.expires_at * 1000;
    const now = Date.now();
    const refreshBefore = expiresAt - now - 2 * 60 * 1000;

    if (refreshBefore <= 0) {
      refreshToken();
      return;
    }

    const timer = setTimeout(() => {
      refreshToken();
    }, refreshBefore);

    return () => clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        refreshToken();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const role = membership?.role || profile?.role || userRecord?.role || "va";

  const value = {
    session,
    user,
    profile,
    userRecord,
    membership,
    organization,
    role,

    vas,
    clients,
    projects,
    invoices,
    tasks,

    loading,
    toast,
    showToast,

    loadAppData,
    refreshWorkspace,
    refreshToken,
    signOutUser,

    addProject,
    addClient,
    addInvoice,
    addTask,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function emptyResult() {
  return {
    data: [],
    error: null,
  };
}

function buildProjectsQuery({ orgId = null, role = "va", userId }) {
  let query = supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (role === "client") {
    return orgId
      ? query.eq("organization_id", orgId)
      : query.eq("user_id", userId);
  }

  if (orgId) {
    return query.eq("organization_id", orgId);
  }

  return query.eq("user_id", userId);
}