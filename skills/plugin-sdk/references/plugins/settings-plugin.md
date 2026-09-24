# Settings

Admin-configurable options — a page of the plugin's own in its settings aside.

| | |
|---|---|
| Types | `ISettingsPlugin`, `ISettings`; `usePluginSettings()` returns `PluginSettingsClient` |
| The portal calls | `setAdminPluginSettingsValue(stored)` after `onLoadCallback` and after each `usePluginSettings().save()`; `getAdminPluginSettings()` each time the settings aside opens |
| Surface | the plugin's settings aside, `ISettings.component` — the layout is [below](#registering-the-page) |
| `useCurrentFile()` | `null` |

Contents: [Registering the page](#registering-the-page) · [The settings client](#the-settings-client) · [A static `saveButton`](#a-static-savebutton)

## Registering the page

`setAdminPluginSettings({ component: SettingsPage })` in `onLoadCallback` registers the page; the component loads and saves through `usePluginSettings()` ([below](#the-settings-client)). Stored settings are an opaque **string** delivered to `setAdminPluginSettingsValue` **after** installation, again on every re-enable, and after every `save()` in the session that saved — for class-side callbacks that need them — and straight after each delivery the portal re-reads `getStatus()` ([plugin.md](plugin.md#iplugin--always-required)). Parse defensively: `null`/`""` is a normal first-run value, and a throw there at load marks the plugin *Failed to initialize* and skips that re-read. They survive a disable/enable cycle.

The page renders in an aside: a header, then your component, then the plugin's metadata, rendered by the portal behind a separator it draws itself (do not duplicate it), and a Save/Cancel footer the portal owns.

## The settings client

`usePluginSettings()` — for `ISettings.component` and any component that wants a stored value.

| Method | Does |
|---|---|
| `load<T>()` | the stored object, or `null` when nothing was saved or the string is not JSON |
| `save(data)` | stores `JSON.stringify(data)`, then calls `setAdminPluginSettingsValue` on the class and re-reads `getStatus()` |
| `setSaveButton(button)` | supplies the aside's Save button — a `ButtonGroup` `{ component: Components.button, props: { label, size, onClick, isDisabled, withLoadingAfterClick, disableWhileRequestRunning } }` |

The portal owns the footer's Save/Cancel look, and it also overrides the button's `size`, `primary` and `scale` — what survives from the `ButtonGroup` is `label` (defaulting to "Save"), `isDisabled`, `isLoading`, `onClick`, `withLoadingAfterClick` and `disableWhileRequestRunning`.

**Without `setSaveButton` — and without a static `saveButton` — the Save button has no `onClick` and saves nothing** — for a React settings page, this is the call that makes the footer work. Make it in an effect that re-runs when the form changes; that is also how `isDisabled` tracks validity. After `onClick` resolves the portal closes the aside. The button state is per plugin and cleared on close. (`ISettings.saveButton`, the static declaration beside `component`, still works and is not deprecated; it is the right choice only when the button never changes state — see [below](#a-static-savebutton).)

**`isDisabled` covers *unchanged* as well as invalid.** The portal draws Save enabled and has no idea whether the form was touched, so a page that only guards validity opens with Save already lit over a form nobody has edited — and pressing it is a real save: a request, a `setAdminPluginSettingsValue` call in the session that saved, a version of the settings written for no reason, and an aside that closes as though something happened. Nothing reports it, and it is the state a settings aside spends most of its life in. So keep what was loaded beside what is being edited and disable Save until they differ:

```ts
const [saved, setSaved] = useState<TConfig>(DEFAULTS);   // what is stored
const [config, setConfig] = useState<TConfig>(DEFAULTS); // what the form shows
// Both are built from the same literal, so key order matches and this is a safe compare.
const dirty = JSON.stringify(config) !== JSON.stringify(saved);
// …props: { isDisabled: invalid || !dirty, onClick: async () => { await settings.save(config); setSaved(config); /* and the toast, below */ } }
```

The `setSaved` after a successful save is what stops a second press re-sending the same values, and holding it to the success branch is what keeps the snapshot honest: it means "this is what is stored", so advancing it after a request that failed would record a value the server never took.

**A field's error waits for the same signal.** `hasError` taken from validity alone is red the moment the aside opens — over an empty field on a fresh install, or over a stored value someone else saved — so the page greets the admin by marking a mistake they have not made. The snapshot already answers who typed: a field the user has touched is one that differs from what was loaded, so `hasError={invalid && config.webhook !== saved.webhook}` stays quiet until they edit it and turns red as they type. `isDisabled` keeps plain `invalid` — an invalid stored value is unsaveable regardless, because an untouched form is not dirty.

**A save says how it went.** `save()` is a request, and the footer reports nothing either way — the aside closes once `onClick` resolves, on a rejected request exactly as on a stored one — so an admin without the console open cannot tell a saved key from a lost one. Wrap the call in `try/catch` and **return an `IMessage`** from each branch, which the host dispatches: the toast without reaching for a hook, `ToastType.success` against `ToastType.error`, and `setSaved` only on the branch that stored something. It is a report rather than an offer to retry — the aside is already closing — so the error line says what to go back and check, not merely that something failed.

```tsx
function SettingsPage() {
  const settings = usePluginSettings();
  const [config, setConfig] = useState<TConfig>(DEFAULTS);   // what the form shows
  const [saved, setSaved] = useState<TConfig>(DEFAULTS);     // what is stored, to compare against
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // `await`, never `.then`: the SDK types load() as a Promise, the portal answers synchronously.
    void (async () => {
      const stored = await settings.load<TConfig>();
      const next = { ...DEFAULTS, ...(stored ?? {}) };
      setConfig(next); setSaved(next); setLoaded(true);
    })();
  }, [settings]);

  const invalid = config.webhook.length > 0 && !/^https:\/\//.test(config.webhook);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);
  const showError = invalid && config.webhook !== saved.webhook;

  useEffect(() => {
    if (!loaded) return;
    settings.setSaveButton({
      component: Components.button,                       // the SDK's Components and ButtonSize, not the kit's
      // Not `isDisabled: invalid` alone - that leaves Save lit on a form nobody edited.
      props: { label: t("save"), size: SdkButtonSize.normal, isDisabled: invalid || !dirty, withLoadingAfterClick: true,
               onClick: async () => {
                 try {
                   await settings.save(config);
                   setSaved(config);                                 // only here - a failed save stays dirty
                   return { actions: [Actions.showToast], toastProps: [{ type: ToastType.success, title: t("saved") }] };
                 } catch {
                   // The aside closes on this branch too, so the toast is the only account of it.
                   return { actions: [Actions.showToast], toastProps: [{ type: ToastType.error, title: t("saveFailed") }] };
                 }
               } },
    });
  }, [settings, config, loaded, invalid, dirty]);

  if (!loaded) return <RectangleSkeleton height="120px" />;
  return (
    // No `gap` on the column: FieldContainer brings its own 16px bottom margin, and the two add up.
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Red only once this field differs from what was loaded - an untouched form accuses nobody. */}
      <FieldContainer isVertical labelVisible labelText={t("webhook")} hasError={showError} errorMessage={t("httpsOnly")}>
        <TextInput type={InputType.text} value={config.webhook} onChange={(e) => setConfig({ ...config, webhook: e.target.value })} scale hasError={showError} />
      </FieldContainer>
      {/* ToggleButton has no intrinsic size, so the wrapper supplies the height and refuses to flex. */}
      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center", flex: "0 0 auto" }}>
        <ToggleButton label={t("notify")} isChecked={config.notify} onChange={() => setConfig({ ...config, notify: !config.notify })} />
      </div>
    </div>
  );
}
```

Registered with `this.setAdminPluginSettings({ component: SettingsPage })` in `onLoadCallback`. Class-side code reads stored values in `setAdminPluginSettingsValue` — a string, arriving after installation; parse in `try/catch`.

Three facts about the store itself that the page does not put together. **The whole object is one string the server caps at 255 characters** — a longer `save()` is refused with a 400, not truncated, so a settings object is a few short scalars, and anything bulkier lives in a file or a portal entity the plugin refers to by id; the `catch` above is what turns that refusal into a toast. **`load()` answers synchronously on the portal** although the SDK types it as a `Promise` — `await` it, as the example does, rather than chaining `.then`, which throws on a plain object and blanks the page. **After `save()` the portal calls `setAdminPluginSettingsValue` and then re-reads `getStatus()`**, so a plugin can hide or show itself from its own configuration ([plugin.md](plugin.md#iplugin--always-required)). Only the session that saved hears about it: other open tabs keep the value they loaded — their `load()` returns it too — until they reload, so a settings page open in another tab shows, and can save back, the old value.

## A static `saveButton`

**`ISettings.saveButton`** is not deprecated — the SDK marks `settings` and `onLoad` deprecated and deliberately leaves this one alone, and the host reads it as the fallback whenever `setSaveButton` has not supplied a React button. So a settings page may declare its Save statically beside a React `component`, and the two differ in one way worth knowing: a static `saveButton`'s `onClick` stores through the portal's own save path and **does not** call `setAdminPluginSettingsValue`, so class-side code never learns the new value, whereas `usePluginSettings().save()` does. Prefer `setSaveButton` for a form whose Save has to track validity ([above](#the-settings-client)); the static one is legitimate for a page whose button never changes state.
