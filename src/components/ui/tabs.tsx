import * as React from "react";
import { cn } from "@/lib/utils";

type TabsCtx = {
  value: string;
  setValue: (v: string) => void;
};
const TabsContext = React.createContext<TabsCtx | null>(null);

export function Tabs({
  defaultValue,
  value: valueProp,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internal, setInternal] = React.useState(defaultValue || "");
  const controlled = valueProp !== undefined;
  const value = controlled ? (valueProp as string) : internal;

  const setValue = (v: string) => {
    if (!controlled) setInternal(v);
    onValueChange?.(v);
  };

  React.useEffect(() => {
    if (!value && defaultValue) setInternal(defaultValue);
  }, [defaultValue]);

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("inline-flex rounded-md border bg-white p-1", className)} {...props} />;
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md",
        active ? "bg-black text-white" : "text-black hover:bg-black/5",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) return null;
  if (ctx.value !== value) return null;
  return (
    <div className={cn("mt-3", className)} {...props}>
      {children}
    </div>
  );
}
