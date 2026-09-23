# Lists: loading, empty, paged

Which list component to use is in [`choosing.md`](choosing.md) — short answer, build your own
rows unless you are rebuilding the portal's file manager. This page is the cycle around a
list: what to draw while it loads, what to draw when it is empty, and what the kit's paging
pieces do and do not do for you.

## The three states

```tsx
import { EmptyView } from "@onlyoffice/apps-ui-kit/components/empty-view";
import { RectangleSkeleton } from "@onlyoffice/apps-ui-kit/components/rectangle";
import { Text } from "@onlyoffice/apps-ui-kit/components/text";

type Member = { id: string; name: string };

export function MemberList({ members, isLoading }: { members: Member[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div aria-busy style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[0, 1, 2, 3].map((row) => (
          <RectangleSkeleton key={row} width="100%" height="32px" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return <EmptyView title="No members yet" description="Invite someone to get started." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {members.map((member) => (
        <Text key={member.id}>{member.name}</Text>
      ))}
    </div>
  );
}
```

## While it loads

**Skeletons, not a spinner**, for a list: they say "this is the shape of what is coming".
`RectangleSkeleton` and `CircleSkeleton` are the two shapes.

- The skeleton colours are **fixed, not themed** — black at 10% and 15% opacity. On a dark
  surface they are nearly invisible; pass `backgroundColor` and `foregroundColor` yourself.
- A skeleton has no accessible name: its `title` defaults to `""`, so the `aria-labelledby`
  on the SVG resolves to nothing. Mark the region `aria-busy`, or give the skeleton standing
  for the whole region a `title`.
- `height="100%"` collapses unless the parent has a height. The SVG has no `viewBox`, so the
  sizes are the element's own pixels.
- The animation never stops; unmount the skeleton when the content arrives.

**`Loader` is for work of unknown duration that is not a list**, and it needs an explicit
type: `LoaderTypes.base` — which is also what an absent `type` falls through to — renders the
`label` as plain text with no animation, so `<Loader />` on its own draws nothing that looks
like waiting. Pass `oval`, `dualRing`, `rombs` or `track`. The wrapper has no size and no
centring of its own.

**`ProgressBar`** is the one to use when there is a real percentage.

## When it is empty

`EmptyView` positions itself: `margin-inline: auto`, capped at 480px, 61px of padding on top.
Put it directly in the region it fills — a wrapper of your own that centres it again will
fight it.

Its `options` list is matched **by shape before type**: an option carrying a `to` field is a
link whatever else it says, so a link cannot also be a button. And a link option without a
`LinkRouter` silently stops navigating — it renders, looks right, and ignores the `to`. Pass
your router's `Link` as `LinkRouter`, or use an `action` option with an `onClick`.

`EmptyScreenContainer` is the older portal equivalent; prefer `EmptyView` in new code.

## Paging and infinite scroll

`Paging` is a row of controls and moves nothing by itself: `previousAction`, `nextAction`,
`onSelectPage` and `onSelectCount` report, and `selectedPageItem` and `selectedCountItem` are
read on every render. If the callbacks do not write back to that state, nothing changes. An
`async` action is not awaited and nothing is shown while it runs.

`InfiniteLoader` is the portal's virtualised list, and it is portal-shaped in two ways that
break silently outside it:

- **It scrolls somebody else's element.** It looks for `#sectionScroll .scroll-wrapper > .scroller`,
  or `#customScrollBar`'s scroller on a narrow viewport — the inner elements of the kit's
  `Scrollbar` — and falls back to the window. It creates no scrolling region of its own.
- **It takes its width from an element found by a literal id**: `#table-container` for the
  `table` layout, `#rowContainer` for everything else. Without one in the document the items
  are laid out at zero width.

Every item is exactly `itemSize` tall and a taller one is clipped. For a list of your own with
ordinary scrolling, an intersection observer and your own markup are less machinery than this.
