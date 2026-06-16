"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    company: "",
    teamSize: "",
    goal: ""
  });

  function update(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function finish() {
    const { data: user } = await supabase.auth.getUser();

    await supabase
      .from("users")
      .update({
        onboarding_completed: true,
        company: form.company,
        team_size: form.teamSize,
        goal: form.goal
      })
      .eq("id", user.user.id);

    router.push("/");
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">

      <div className="w-96 bg-white p-6 rounded-xl shadow space-y-4">

        {/* STEP INDICATOR */}
        <div className="text-xs text-slate-500">
          Step {step} of 3
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <input
            name="company"
            placeholder="Company Name"
            className="w-full border p-2 rounded"
            onChange={update}
          />
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <input
            name="teamSize"
            placeholder="Team Size"
            className="w-full border p-2 rounded"
            onChange={update}
          />
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <input
            name="goal"
            placeholder="Main Goal (e.g. manage VAs)"
            className="w-full border p-2 rounded"
            onChange={update}
          />
        )}

        {/* BUTTONS */}
        <div className="flex justify-between">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="bg-indigo-600 text-white px-3 py-1 rounded"
            >
              Next
            </button>
          ) : (
            <button
              onClick={finish}
              className="bg-green-600 text-white px-3 py-1 rounded"
            >
              Finish
            </button>
          )}
        </div>

      </div>
    </div>
  );
}