import type { Metadata } from "next";
import { UserMinus } from "lucide-react";
import { PageTitle } from "@/components/admin/AdminCard";
import { PickPersonForm } from "@/components/admin/PickPersonForm";
import { Card } from "@/components/ui/Card";
import { requirePermission } from "@/lib/access";
import { loadPeopleOptions, personName } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { assignRole, endRoleAssignment } from "../actions";

export const metadata: Metadata = { title: "Rôles" };

type Assignment = {
  id: string;
  role_id: string;
  people: { first_name: string; last_name: string } | null;
};

export default async function RolesPage() {
  await requirePermission("roles.manage");
  const supabase = await createClient();
  const [{ data: roles }, { data: assignments }, people] = await Promise.all([
    supabase.from("roles").select("id, code, label, description").order("system", { ascending: false }).order("label"),
    supabase
      .from("role_assignments")
      .select("id, role_id, people(first_name, last_name)")
      .eq("scope_type", "church")
      .is("end_date", null),
    loadPeopleOptions(),
  ]);
  const list = (assignments ?? []) as unknown as Assignment[];
  const visibleRoles = (roles ?? []).filter((r) => r.code !== "member");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 pb-8 pt-5">
      <PageTitle
        title="Rôles"
        intro="Les rôles valables pour toute l'église. Les responsables de groupe se désignent dans chaque groupe."
      />

      <Card className="shadow-card">
        <h2 className="mb-3 text-lg font-semibold">Attribuer un rôle</h2>
        <PickPersonForm action={assignRole} hidden={{}} label="Personne" people={people} submitLabel="Attribuer le rôle">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Rôle</span>
            <select
              name="role_id"
              required
              defaultValue=""
              className="min-h-13 rounded-2xl border-2 border-line bg-surface px-3 text-base focus:border-ink/40"
            >
              <option value="" disabled>
                Choisir un rôle…
              </option>
              {visibleRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </PickPersonForm>
      </Card>

      {visibleRoles.map((role) => {
        const holders = list.filter((a) => a.role_id === role.id);
        return (
          <section key={role.id} aria-labelledby={`role-${role.code}`}>
            <h2 id={`role-${role.code}`} className="font-semibold">
              {role.label}
            </h2>
            {role.description && <p className="mb-2 text-sm text-muted">{role.description}</p>}
            {holders.length === 0 ? (
              <p className="rounded-card bg-surface p-3 text-sm text-muted">Personne pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-card bg-surface px-4 shadow-card">
                {holders.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-semibold">{personName(a.people!)}</span>
                    <form action={endRoleAssignment}>
                      <input type="hidden" name="assignment_id" value={a.id} />
                      <button
                        type="submit"
                        className="grid size-11 place-items-center rounded-full text-alert-text hover:bg-alert-bg"
                        aria-label={`Retirer le rôle ${role.label} à ${personName(a.people!)}`}
                      >
                        <UserMinus aria-hidden className="size-5" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
