// A members panel from a branch nobody finished.
import { useState } from "react";

import "@onlyoffice/apps-ui-kit/styles.css";
import { Aside } from "@onlyoffice/apps-ui-kit/components/aside";
import { FieldContainer } from "@onlyoffice/apps-ui-kit/components/field-container";
import { SearchInput } from "@onlyoffice/apps-ui-kit/components/search-input";
import { TextInput } from "@onlyoffice/apps-ui-kit/components/text-input";
import { PeopleSelector } from "@onlyoffice/apps-ui-kit/selectors/People";
import CrossIcon from "PUBLIC_DIR/images/cross.react.svg";

type Member = { id: string; name: string; email: string };

type PanelProps = {
  open: boolean;
  members: Member[];
  onClose: () => void;
};

export function MembersPanel({ open, members, onClose }: PanelProps) {
  const [query, setQuery] = useState("");
  const [invite, setInvite] = useState("");

  const shown = members.filter((member) =>
    member.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <Aside isVisible={open} onClose={onClose} header="Members">
      <img src={CrossIcon} alt="" onClick={onClose} />

      <SearchInput
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <FieldContainer isVertical labelText="Invite by email">
          <TextInput
            scale
            value={invite}
            onChange={(event) => setInvite(event.target.value)}
          />
        </FieldContainer>

        <PeopleSelector onAccept={() => {}} />
      </div>

      <ul>
        {shown.map((member) => (
          <li key={member.id}>
            {member.name} — {member.email}
          </li>
        ))}
      </ul>
    </Aside>
  );
}
