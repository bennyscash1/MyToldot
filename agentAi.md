Project Context: Toldotay (תולדותיי)
1. Project Overview & Vision
Toldotay is a modern, interactive SaaS platform designed for building and preserving family legacies. Unlike static genealogy tools, Toldotay serves as a "Living Family Encyclopedia," focusing on narrative preservation, multimedia archives, and collaborative heritage.

Core Goals:
Narrative Preservation: Going beyond names and dates to store oral histories, biographies, and media.

Multi-tenant Isolation: A SaaS architecture where each family tree exists in a completely isolated environment (Tenant).

Collaboration: Allowing multiple family members to contribute while maintaining strict permission controls.

Accessibility: Using simple 5-digit short-codes for easy sharing and joining.

2. Technical Stack
Framework: Next.js (App Router)

Language: TypeScript (Strict type-safety)

Backend & Auth: Supabase (PostgreSQL, Auth, and Storage)

ORM: Prisma

Visualization: React Flow (for dynamic tree rendering)

Styling: Tailwind CSS (Responsive UI)

i18n: Bilingual support (Hebrew - RTL / English - LTR)

3. Core Features & Logic
A. Tree Access & Routing
Short-Code System: Family trees are accessed via a unique 5-digit string (e.g., /tree/12345) rather than long UUIDs.

Family Hub: If a user is associated with multiple families, a selector page (Hub) is displayed upon login to choose which tree to enter.

Join via Code: Registered users can enter a short-code on the landing page to instantly join a family as a VIEWER.

B. Role-Based Access Control (RBAC)
Permissions are managed via the TreeMember table with the following hierarchy:

OWNER: Full control, can manage members and settings.

EDITOR: Can add, edit, or delete people and relationships within the tree.

EDITOR_PENDING: A transitional state when a Viewer requests edit rights.

VIEWER: Read-only access (default for new members).

GUEST: Public access (if the tree is set to public), hidden sensitive metadata.

C. Data Integrity Rules
Mandatory Gender: All person nodes must have a gender defined.

Spouse Logic: "Add Spouse" automatically assigns the opposite gender of the focal person.

Multi-tenant Guard: Every database query and server action must be scoped by treeId to ensure data isolation.

4. Current Workflows & UI
Landing Page: Contains a "Create Family" button (protected for logged-in users) and a "Join Family" input field.

Registration: User registration is immediate and unrestricted. Global "Pending Approval" states are avoided; approval is only required for elevated permissions within a specific tree.

Permissions-Aware UI: "Add/Edit/Delete" buttons are programmatically hidden for users with VIEWER or GUEST roles.

5. Agent Instructions (Guidelines for the AI)
Never Break Multi-tenancy: Ensure every action validates the treeId and the user's role in that specific tree.

Preserve React Flow: Changes to fetching logic must not break the Nodes and Edges structure required for the tree visualization.

Sync DB: Always ensure the Prisma schema remains in sync with the Supabase PostgreSQL instance.

Clean UI: Maintain the "Toldotay" branding; ensure responsive design and proper RTL/LTR support.