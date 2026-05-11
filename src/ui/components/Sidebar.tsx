import type { CSSProperties, ReactNode } from "react";

const SIDEBAR_WIDTH = 240;

export function Sidebar({ children }: { children: ReactNode }) {
  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        minWidth: SIDEBAR_WIDTH,
        background: "#f3efe6",
        borderRight: "1px solid #ccc",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflowY: "auto",
      }}
    >
      {children}
    </aside>
  );
}

export function SidebarSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 style={sectionTitleStyle}>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

export function SidebarButton({
  children,
  onClick,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...buttonStyle, ...(variant === "secondary" ? secondaryButtonStyle : {}) }}
    >
      {children}
    </button>
  );
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 6px 0",
  color: "#555",
};

const buttonStyle: CSSProperties = {
  padding: "8px 12px",
  background: "#2b6cb0",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#888",
};
