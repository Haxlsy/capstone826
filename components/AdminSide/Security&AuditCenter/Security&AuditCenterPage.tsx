"use client"

import AuditLog from "../AuditLog"

export default function SecurityAuditCenter({ initialLogs }: { initialLogs: any[] }) {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Security &amp; Audit Center</h1>
            <p className="text-body mb-6">Comprehensive logs of system access and actions.</p>
            <AuditLog initialLogs={initialLogs} />
        </div>
    )
}
