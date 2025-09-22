import { useState } from "react";
import { ParticipantSearch, type Participant } from "./ParticipantSearch";
import { ParticipantItem } from "./ParticipantItem";
import { Label } from "@/components/ui/label";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParticipantManagerProps {
  participants: Participant[];
  onChange: (participants: Participant[]) => void;
  className?: string;
}


export function ParticipantManager({
  participants,
  onChange,
  className,
}: ParticipantManagerProps) {
  const [searchValue, setSearchValue] = useState<Participant | undefined>();

  const handleAddParticipant = (participant: Participant) => {
    // Check if participant is already added
    const exists = participants.some(p => p.pubkey === participant.pubkey);
    if (exists) {
      return;
    }

    onChange([...participants, participant]);
    setSearchValue(undefined);
  };

  const handleRemoveParticipant = (pubkey: string) => {
    onChange(participants.filter(p => p.pubkey !== pubkey));
  };

  const handleRoleChange = (pubkey: string, role: string) => {
    onChange(
      participants.map(p =>
        p.pubkey === pubkey ? { ...p, role } : p
      )
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Event Participants
        </Label>
        <p className="text-xs text-muted-foreground">
          Add speakers, moderators, and other participants to your event. These will be included as p tags in the event per NIP-52.
        </p>
      </div>

      <ParticipantSearch
        value={searchValue}
        onChange={handleAddParticipant}
      />

      {participants.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Added Participants ({participants.length})
          </Label>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {participants.map((participant) => (
              <ParticipantItem
                key={participant.pubkey}
                participant={participant}
                onRoleChange={(role) => handleRoleChange(participant.pubkey, role)}
                onRemove={() => handleRemoveParticipant(participant.pubkey)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}