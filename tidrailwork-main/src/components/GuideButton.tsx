import { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type GuideButtonProps = {
  title: string;
  steps: string[];
  note?: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
};

export function GuideButton({ title, steps, note, align = "end", className = "" }: GuideButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-muted-foreground hover:text-foreground ${className}`}
          aria-label={`Guide: ${title}`}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80">
        <div className="text-sm font-medium">{title}</div>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {steps.map((step, idx) => (
            <li key={`${idx}-${step.slice(0, 12)}`}>{step}</li>
          ))}
        </ol>
        {note ? <div className="mt-2 text-xs text-muted-foreground">{note}</div> : null}
      </PopoverContent>
    </Popover>
  );
}
