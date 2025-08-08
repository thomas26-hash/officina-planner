import * as React from "react";
import * as RSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function Select({
  value,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<typeof RSelect.Root>) {
  return (
    <RSelect.Root value={value as string | undefined} onValueChange={onValueChange} {...props}>
      {children}
    </RSelect.Root>
  );
}

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RSelect.Trigger>) {
  return (
    <RSelect.Trigger
      className={cn(
        "inline-flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-black/20",
        className
      )}
      {...props}
    >
      {children}
      <RSelect.Icon>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </RSelect.Icon>
    </RSelect.Trigger>
  );
}

export function SelectValue(props: React.ComponentProps<typeof RSelect.Value>) {
  return <RSelect.Value {...props} />;
}

export function SelectContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RSelect.Content>) {
  return (
    <RSelect.Portal>
      <RSelect.Content
        className={cn(
          "z-50 overflow-hidden rounded-md border bg-white shadow-lg",
          className
        )}
        {...props}
      >
        <RSelect.ScrollUpButton className="flex items-center justify-center py-1">
          <ChevronUp className="h-4 w-4 opacity-60" />
        </RSelect.ScrollUpButton>
        <RSelect.Viewport className="p-1">{children}</RSelect.Viewport>
        <RSelect.ScrollDownButton className="flex items-center justify-center py-1">
          <ChevronDown className="h-4 w-4 opacity-60" />
        </RSelect.ScrollDownButton>
      </RSelect.Content>
    </RSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RSelect.Item>) {
  return (
    <RSelect.Item
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none",
        "focus:bg-black/5 data-[state=checked]:font-medium",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 inline-flex w-4">
        <RSelect.ItemIndicator>
          <Check className="h-4 w-4" />
        </RSelect.ItemIndicator>
      </span>
      <RSelect.ItemText>{children}</RSelect.ItemText>
    </RSelect.Item>
  );
}
