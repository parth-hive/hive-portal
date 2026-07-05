import { createClient } from "@/lib/supabase/server";
import { isMaster } from "@/lib/access";
import { boardAdmin, listBoardMembers, type BoardTask } from "@/lib/board";
import { ProjectsBoard, type BoardComment } from "./board";

export const dynamic = "force-dynamic";

export type TaskWithComments = BoardTask & { board_comments: BoardComment[] };

export default async function ProjectsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = isMaster(user?.email);

  const sb = boardAdmin();
  const [{ data }, members] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sb as any)
      .from("board_tasks")
      .select(
        "*, board_comments(id, author, author_label, text, created_at)",
      )
      .order("created_at", { ascending: false })
      .order("created_at", {
        referencedTable: "board_comments",
        ascending: true,
      }),
    listBoardMembers(sb),
  ]);

  const tasks = (data ?? []) as TaskWithComments[];
  // Emails stay server-side; the client only needs names for display.
  const safeMembers = members.map((m) => ({
    id: m.id,
    name: m.name,
    isAdmin: m.isAdmin,
  }));

  return (
    <ProjectsBoard
      tasks={tasks}
      members={safeMembers}
      meId={user?.id ?? ""}
      admin={admin}
    />
  );
}
