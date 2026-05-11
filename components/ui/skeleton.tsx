export function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`bg-gray-200 rounded-md ${className ?? ""}`} style={style} />
}

export function SkRow({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={`flex items-center gap-3 ${className ?? ""}`} style={style}>{children}</div>
}
