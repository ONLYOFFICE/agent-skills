# Angular recipe

```ts
import {
  Component, AfterViewInit, OnDestroy, Input, NgZone,
} from "@angular/core";
import SDK, { type SDKInstance } from "@onlyoffice/docspace-sdk-js";

@Component({
  selector: "app-docspace",
  standalone: true,
  template: `<div [id]="frameId" style="height: 700px"></div>`,
})
export class DocspaceComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) portalUrl!: string;
  @Input() frameId = "ds-frame";

  private instance: SDKInstance | null = null;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    // postMessage traffic shouldn't trigger change detection on every frame message
    this.zone.runOutsideAngular(() => {
      this.instance = new SDK().initManager({
        frameId: this.frameId,
        src: this.portalUrl,
        events: {
          onAppReady: () => {},
          onSelectCallback: (item) =>
            this.zone.run(() => this.handleSelection(item)),  // re-enter for UI updates
          onAppError: (m) => console.error(m),
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.instance?.destroyFrame();
    this.instance = null;
  }

  private handleSelection(item: object): void {}
}
```

Key points:

- Init in `ngAfterViewInit` (the container must be in the DOM), destroy in `ngOnDestroy`.
- `runOutsideAngular` around init keeps the SDK's `message` listener from triggering
  change detection on every postMessage; wrap only the handlers that update UI in
  `zone.run`.
- Angular Universal / SSR: guard with `isPlatformBrowser` or make the component
  client-only — the SDK module touches `window` at import time.
- To change the embedded entity, destroy and re-init (or `setConfig({ id }, true)`).
