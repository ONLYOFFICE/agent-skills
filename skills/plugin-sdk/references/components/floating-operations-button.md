# The floating operations button

The portal's progress button (downloads, conversions) accepts plugin entries — the way to show progress without holding a surface open, and it works from a component and from a class-side callback alike ([below](#work-that-takes-a-while)).

| | |
|---|---|
| Types | `IFloatingOperationsButton` (`FloatingOperationType`) |
| Class side | `Actions.addFloatingOperationsButton` / `updateFloatingOperationsButton` with `floatingOperationsButtonProps`; `Actions.removeFloatingOperationsButton` with `floatingOperationsButtonPropsId`, a bare string |
| From a component | the same names on `usePluginActions()` |

Contents: [Work that takes a while](#work-that-takes-a-while) — no surface, a surface, a few named steps on a page

```ts
const op = (percent: number, completed = false) => ({
  id: "my-plugin-export",
  operationsCompleted: completed,   // ← the field the portal watches; the one below only draws the row
  operations: [{ id: "export", label: t("exporting"), operation: FloatingOperationType.Other, alert: false, completed, percent }],
});
addFloatingOperationsButton(op(0));
for (…) { await …; updateFloatingOperationsButton(op(pct)); }
updateFloatingOperationsButton(op(100, true));   // sets operationsCompleted - the portal takes it from here
```

- **Add before update.** `add` ignores an id already registered, `update` ignores one that is not — an update sent first is a silent no-op. `update` takes the whole props object again.
- **Two different `completed` fields, and only the outer one ends the job.** `operations[i].completed` draws that row; **`operationsCompleted` on the button props** is what the portal reads. When it turns true the panel waits 4 seconds, plays its hide animation, and on the animation's end clears every operation the plugin registered — so the button removes *itself*, and the entry stops claiming to be running. Set only the inner `completed` and the button never leaves: the job is over, the label still reads "…ing", and it stays there until the page is reloaded. Nothing catches this — the validator sees a correct add/update sequence and a render pass has no panel — so it is worth re-reading the last `update` you write against this bullet.
- **The finished wording is the portal's, not yours.** At completion it renders your operation `label` inside its own phrase — `"{{label}}: Done"`, or `"{{label}}: Error"` in the error path — so the label wants to be a plain name of the work ("Archiving rooms"), never rewritten to the past tense on the last update.
- **The 4-second dismissal waits for the user.** It does not run while the pointer is over the button or while the operations dropdown is open, which is deliberate: the completed state is readable before it goes.
- **`onLoad` is the class's handle on the button.** `IFloatingOperationsButton.onLoad?: (dispatchMessage) => …` is called by the host once the entry appears, and it is handed the same dispatcher a callback's returned `IMessage` goes through. Keep that function and a class-side job can send `updateFloatingOperationsButton` as often as it likes, from its own loop, with nothing mounted — see [below](#work-that-takes-a-while). It fires once per `id` while the Files page is mounted, and again after the entry has been cleared, so treat it as "the button now exists" rather than "start the work here".
- **Give the button an id nobody else will use** — prefix it with the manifest `name`, as with item keys. The host tracks entries by the bare `id`, so two plugins that both call theirs `export` write over each other's progress.
- `remove` takes the button `id` as a bare string (`floatingOperationsButtonPropsId` class-side). The normal end of a job needs no `remove` — reach for it to drop the button *early*, or from a cleanup when the surface goes away with the work still unfinished.
- Operation ids are prefixed by the host with the plugin name; `onCancelOperationFromList(operationId)` hands back your unprefixed id. `cancelOperation` fires for "cancel all". Dismissing the button drops all your operations.
- `FloatingOperationType`: `Download`, `Convert`, `Copy`, `Upload`, `Backup`, … or `Other`.

## Work that takes a while

Packing an archive, walking a room, converting a batch: anything past a second or two. Two shapes fit it, and the question that picks between them is whether the user needs a **surface** — something to look at or interact with while it runs — not where the click came from. A few named steps started by hand are a third case, at the end.

**No surface: run it from the class, and report through the progress button's `onLoad`.** A callback returns one `IMessage` and cannot send a second, but `addFloatingOperationsButton` carries an `onLoad` the host calls with its dispatcher, and holding that function is holding a channel back to the portal for as long as the plugin wants one. So a menu item that exports a folder needs no modal at all:

```ts
let dispatch: ((message: IMessage) => void) | null = null;
const BUTTON = "my-plugin-export";                       // manifest-prefixed: the host keys buttons by bare id

const button = (percent: number, completed = false, alert = false): IFloatingOperationsButton => ({
  id: BUTTON, operationsCompleted: completed, operationsAlert: alert,
  operations: [{ id: "export", label: t("export.running"), operation: FloatingOperationType.Other, alert, completed, percent }],
  onLoad: (dispatchMessage) => { dispatch = dispatchMessage; },
});

const progress = (percent: number, completed = false, alert = false) =>
  dispatch?.({ actions: [Actions.updateFloatingOperationsButton], floatingOperationsButtonProps: button(percent, completed, alert) });

onItemClick = async (id: number): Promise<IMessage> => {
  void (async () => {                                     // the work outlives the message
    try {
      for (const [i, file] of (await listFiles(id)).entries()) { await pack(file); progress(pct(i)); }
      progress(100, true);
    } catch { progress(100, true, true); }                 // finish, flagged: the portal renders "…: Error"
  })();
  return { actions: [Actions.addFloatingOperationsButton], floatingOperationsButtonProps: button(0) };
};
```

The loop is unguarded by anything — the callback has already returned, so a throw escaping that `catch` is an unhandled rejection and the button stays at whatever percent it reached. And the plugin owns the whole lifetime: nothing unmounts, so nothing cancels for you.

**A surface: the work goes in its effect, and the effect can run twice.** When there *is* something to show — a preview, a per-row log, a form the job reads — the click opens the modal or page and hands over the id, and the component runs the work. React remounts effects (development double-invoke, a re-render with changed deps, the user reopening the panel), and a second run of "pack these 400 files" is duplicated writes rather than a slow render. Guard the start, own the cancellation, and never leave the button behind:

```tsx
const ExportPanel = () => {
  const { addFloatingOperationsButton, updateFloatingOperationsButton, removeFloatingOperationsButton, showToast } = usePluginActions();
  const api = usePluginAPI();
  const started = useRef(false);              // module scope if the work must survive a remount

  useEffect(() => {
    if (started.current) return;              // the second invocation is not a second job
    started.current = true;

    const controller = new AbortController();
    const BUTTON = "my-plugin-export";         // manifest-prefixed: the host keys buttons by bare id
    const button = (percent: number, completed = false, alert = false) => ({
      id: BUTTON,
      operationsCompleted: completed,          // the portal's own dismissal hangs off this one
      operationsAlert: alert,
      operations: [{ id: "export", label: t("export.running"), operation: FloatingOperationType.Other,
                     alert, completed, percent }],
    });
    // Ended: the portal shows "…: Done" (or "…: Error"), waits, and clears the entry itself.
    const finish = (alert = false) =>
      updateFloatingOperationsButton(button(100, true, alert));

    (async () => {
      addFloatingOperationsButton(button(0));  // add first, or every update is a no-op
      try {
        let percent = 0;
        for (let i = 0; i < files.length; i += 1) {
          // Abandoned, not finished - finish() here would announce "Done" over a partial job.
          if (controller.signal.aborted) return removeFloatingOperationsButton(BUTTON);
          await pack(api, files[i], controller.signal);

          const next = Math.round(((i + 1) / files.length) * 100);
          if (next > percent) updateFloatingOperationsButton(button((percent = next)));   // whole percents only
        }
        finish();
        showToast({ type: ToastType.success, title: t("export.done") });
      } catch (e) {
        // Aborted mid-file is abandoned too, like the check above - not a failure to report.
        if (isPluginApiError(e) && e.code === "ABORTED") return removeFloatingOperationsButton(BUTTON);
        finish(true);   // never leave it spinning: an unfinished entry is never dismissed
        showToast({ type: ToastType.error, title: isPluginApiError(e) ? e.message : t("export.failed") });
      }
    })();

    // Closing the surface abandons this job: abort, and the loop drops the button itself. A job that
    // writes should rather finish - leave the abort out, and its button, the only place it reports,
    // stays after the surface is gone (see below).
    return () => controller.abort();
  }, []);

  return <Text>{t("export.running")}</Text>;
};
```

- **The user closing the surface does not stop the work** — only the `AbortController` in the cleanup does, and only for what takes the signal. Decide deliberately which it should be: a half-written archive is worse than a slow one, so a job that writes usually finishes and reports through the toast, while a read-only walk aborts.
- **Rate-limit the updates.** One `updateFloatingOperationsButton` per file on 400 files is 400 re-renders of the portal's own button; update on whole percents.
- **Nothing wraps the effect.** An uncaught throw blanks the component ([rendering.md](../react/rendering.md#errors-loading-language-styling)), so the `catch` is what turns a failure into a message instead of an empty panel.

**A few named steps on a page: show the step, not a percentage, and make "again" cheap.** Three to ten steps started by hand — pick, copy, fill, upload, open — are too short for the progress button and too long for a merely disabled button. So: a list with one running row and a visible spinner on it, the failed row carrying its error text, and the start button turning into "Run again", which begins from a clean slate so a stale "failed" cannot be read as the new one. State lives on the surface — the user is looking at it, and nothing outlives the page.

```tsx
type Step = { id: string; label: string };
type Status = "idle" | "running" | "done" | "failed";
type Report = (id: string, status: Status, error?: string) => void;

const StepRun = ({ steps, run }: { steps: Step[]; run: (report: Report, signal: AbortSignal) => Promise<void> }) => {
  const [state, setState] = useState<Record<string, { status: Status; error?: string }>>({});
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const failed = Object.values(state).some((s) => s.status === "failed");

  const start = async () => {
    setState({});                                           // a rerun starts clean
    setBusy(true);
    controller.current = new AbortController();
    const report: Report = (id, status, error) => setState((s) => ({ ...s, [id]: { status, error } }));
    try {
      await run(report, controller.current.signal);         // each step: report(id, "running"); …; report(id, "done")
    } catch (e) {                                           // the step that threw reports itself as failed with the message
      if (!(isPluginApiError(e) && e.code === "ABORTED")) report("run", "failed", isPluginApiError(e) ? e.message : t("run.failed"));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => () => controller.current?.abort(), []);   // leaving the page abandons the run

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((step) => {
        const s = state[step.id];
        return (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 24 }}>
            {s?.status === "running"
              ? <Loader type={LoaderTypes.oval} size="16px" color="var(--accent-main)" label={step.label} />   // the default type draws text, not a spinner
              : <Text color={s?.status === "failed" ? "var(--input-error-color)" : "var(--text-disable-color)"}>{s?.status === "done" ? "✓" : s?.status === "failed" ? "!" : "·"}</Text>}
            <Text>{step.label}</Text>
            {s?.error && <Text color="var(--input-error-color)">{s.error}</Text>}
          </div>
        );
      })}
      <Button primary scale size={ButtonSize.normal} isLoading={busy} isDisabled={busy}
              label={failed ? t("run.again") : t("run.start")} onClick={() => void start()} />
    </div>
  );
};
```

- **The failure stays on screen with its cause, and the inputs stay editable.** A "no permission" from a copy is fixed by picking another folder, so the pickers above the list are not disabled by a failed run — only by a running one.
- **A step that writes is not a step to retry blindly.** "Run again" after a copy that *did* succeed and an upload that failed would copy twice; either make the earlier steps idempotent (reuse the id the copy returned) or start the rerun at the failed step.
