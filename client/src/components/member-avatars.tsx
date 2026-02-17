import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { GroupMember } from "@shared/schema";
import { Crown } from "lucide-react";

const colors = [
  "bg-primary",
  "bg-accent", 
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function getColorForMember(index: number) {
  return colors[index % colors.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface MemberAvatarsProps {
  members: GroupMember[];
  showNames?: boolean;
  size?: "sm" | "md" | "lg";
  progress?: Record<string, { swipeCount: number; total: number }>;
}

export function MemberAvatars({ members, showNames = false, size = "md", progress }: MemberAvatarsProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  if (showNames) {
    return (
      <div className="flex flex-wrap gap-3">
        {members.map((member, index) => (
          <div key={member.id} className="flex items-center gap-2">
            <div className="relative">
              <Avatar className={sizeClasses[size]}>
                <AvatarFallback className={`${getColorForMember(index)} text-white font-medium`}>
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              {member.isHost && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Crown className="w-2.5 h-2.5 text-yellow-900" />
                </div>
              )}
            </div>
            <span className="text-sm font-medium" data-testid={`text-member-name-${member.id}`}>
              {member.name}
              {member.isHost && <span className="text-muted-foreground ml-1">(Host)</span>}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex -space-x-2">
      {members.map((member, index) => {
        const memberProg = progress?.[member.id];
        return (
          <div key={member.id} className="relative" title={memberProg ? `${member.name}: ${memberProg.swipeCount}/${memberProg.total}` : member.name}>
            <Avatar className={`${sizeClasses[size]} border-2 border-background`}>
              <AvatarFallback className={`${getColorForMember(index)} text-white font-medium`}>
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            {member.isHost && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                <Crown className="w-2.5 h-2.5 text-yellow-900" />
              </div>
            )}
            {memberProg && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-background rounded-full px-1 border text-[8px] font-bold text-muted-foreground whitespace-nowrap">
                {memberProg.swipeCount}/{memberProg.total}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
