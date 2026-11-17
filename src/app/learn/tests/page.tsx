import { TESTS } from "@/content";
import { requireChild, userStore } from "@/lib/server/context";
import { PageHeader } from "@/components/shell/PageHeader";
import { WorksheetList } from "@/components/WorksheetList";
import { doneCounts } from "@/lib/dashboard";

export default async function Tests() {
  const { parent, child } = await requireChild();
  const done = doneCounts(await (await userStore()).listSessions(parent.id, child.id));
  return (
    <div>
      <PageHeader title="Practice tests" sub="Unit test 2 practice follows the school's UT2 paper: 25 marks (20 written + 5 oral), 40 minutes. Practice tests 1–3 follow the Term 1 paper: 40 marks, 1 hour; Test 1 is the actual Term 1 paper." />
      <WorksheetList worksheets={TESTS} done={done} tone="sky" />
    </div>
  );
}
