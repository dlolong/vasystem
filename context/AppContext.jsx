"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
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

  async function signOutUser(message = "Session expired. Please login again.") {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setMembership(null);
    setOrganization(null);
    showToast(message, "error");
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

    setSession(currentSession);
    setUser(currentSession.user);

    const userId = currentSession.user.id;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError) {
      showToast(profileError.message, "error");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const { data: membershipData, error: membershipError } = await supabase
      .from("memberships")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1)
      .single();

    if (membershipError) {
      showToast("No active workspace found.", "error");
      setLoading(false);
      return;
    }

    setMembership(membershipData);

    const orgId = membershipData.organization_id;

    const { data: orgData } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    setOrganization(orgData);

    await loadWorkspaceData(orgId, membershipData.role, userId);

    setLoading(false);
  }, []);

  async function loadWorkspaceData(orgId, role, userId) {
    if (!orgId) return;

    const [
      vasResult,
      clientsResult,
      projectsResult,
      invoicesResult,
      tasksResult,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("*")
        .eq("organization_id", orgId)
        .eq("role", "va"),

      supabase
        .from("clients")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),

      supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),

      supabase
        .from("invoices")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false }),

      role === "va"
        ? supabase
            .from("tasks")
            .select("*")
            .eq("organization_id", orgId)
            .eq("assigned_to", userId)
            .order("created_at", { ascending: false })
        : supabase
            .from("tasks")
            .select("*")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false }),
    ]);

    setVas(vasResult.data || []);
    setClients(clientsResult.data || []);
    setProjects(projectsResult.data || []);
    setInvoices(invoicesResult.data || []);
    setTasks(tasksResult.data || []);

    const errors = [
      vasResult.error,
      clientsResult.error,
      projectsResult.error,
      invoicesResult.error,
      tasksResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      showToast(errors[0].message, "error");
    }
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
    if (!membership || !user) return;

    await loadWorkspaceData(
      membership.organization_id,
      membership.role,
      user.id
    );
  }

  async function addProject(payload) {
    if (!membership || !user) return;

    const { error } = await supabase.from("projects").insert({
      ...payload,
      organization_id: membership.organization_id,
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
    if (!membership) return;

    const { error } = await supabase.from("clients").insert({
      ...payload,
      organization_id: membership.organization_id,
    });

    if (error) {
      showToast(error.message, "error");
      return;
    }

    showToast("Client added successfully.");
    await refreshWorkspace();
  }

  async function addInvoice(payload) {
    if (!membership || !user) return;

    const { error } = await supabase.from("invoices").insert({
      ...payload,
      organization_id: membership.organization_id,
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
    if (!membership || !user) return;

    const { error } = await supabase.from("tasks").insert({
      ...payload,
      organization_id: membership.organization_id,
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
        setMembership(null);
        setOrganization(null);
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

  const role = membership?.role;

  const value = {
    session,
    user,
    profile,
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