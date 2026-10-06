"use client"

import AuditLog from "../AuditLog"

export default function SecurityAuditCenter() {
    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Security &amp; Audit Center</h1>
            <p className="text-body mb-6">Tracks user activity and account security events across the system.</p>
            <AuditLog />
        </div>
    )
}
