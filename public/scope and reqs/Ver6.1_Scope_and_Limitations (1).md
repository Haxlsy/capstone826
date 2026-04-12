# SCOPE AND LIMITATIONS (Version 6.0)
## A Web-Based Vehicle Service Management System for 826 Auto Care OPC

---

## Scope and Limitations
[brief statement of scope and limtiation to be added here]
---

## Scope of the Project

### Internal Staff Side – Web Page (Super Admin, Operations, Sales)

**Login Page** – Role-based login for all internal staff users. One initial Super Admin account is provided by the system developers. Admin accounts are created exclusively by the Super Admin. All other internal accounts are created by the Admin.
---

### Super Admin 
The Super Admin holds all functions of the Admin role and is additionally granted exclusive authority over Admin account management.
Admin Account Management Module – Accessible to the Super Admin; enables creation, editing, and archiving of Admin accounts.
- Add Admin Account – Create login credentials and a profile for a new Admin user.
- Edit Admin Account – Modify Admin user details such as full name and reset password.
- Archive Admin Account – Deactivate an Admin account while preserving records for reference.

### Admin Role Modules

The Admin holds full system management authority over all non-Admin internal accounts and system configuration, but cannot create, edit, or archive Admin or Super Admin accounts.

**Dashboard** – System overview with statistics and quick access shortcuts.

**Account Management Module (Manage User Accounts)** – Enables creation, editing, and archiving of all internal user accounts: Operations, Sales, Head Detailer, Head Installer, Installer, and Detailer. Installer and Detailer accounts do not access the system and are created for administrative tracking and technician assignment purposes.

- Add User Account – Create login credentials and a profile internall staff.
- Edit User Account – Modify user details such as full name and reset password.
- Archive User Account – Deactivate an internall staff account while preserving records.

**AI Chatbot Management Module** – Configure and manage the AI chatbot's knowledge base and instructions.

- Update Chatbot Instructions – Modify the system prompt and conversation guidelines that control the chatbot's responses to customer inquiries.
- Manage Chatbot Knowledge Base – Add, edit, or remove information about services, pricing, business hours, and frequently asked questions that the chatbot uses to respond to customers.

---

### Operations Role Modules

**Dashboard / Operations Center** – Real-time overview with job status summary cards and Job Calendar View.

- Summary Cards 
  – Job counts by status: Pending, Ongoing, For Rework, For Release, Released, Delayed.
  - Concern counts
- Job Calendar View – All scheduled jobs in calendar format.
- Quick Access – Shortcuts to recent jobs and flagged concerns.

**Job Management Module** – Create, edit, and assign technicians.
- Create Job Order – Assign detailers, installers, single head detailler and head installer, select service type, set actual service start date. Auto-fill customer information (full name, contact number, and email) and vehicle information (plate number and unit) from Sales customer record or manual input if not booked through messenger.
- Edit Job Order – Modify assigned teams, scheduled date/time, customer details and vehicle information. Scheduled date/time cannot be modified once started by tehcnician.
- Search – By customer name, plate number, or job order ID.
- View Details – Display current status, service stage progression, auto update status (successfully sent/uncessfull updates),  assigned teams, scheduled timeline, expected completion date, photo and video documentation.
- Reflects Current Progress – Displays real-time documentation and status updates from Head Detailer and Head Installer.
- clickable "resend update" in service stage progression for error/unsuccessful updates.
- Update to Released Status – Once job order reaches "For Release" status, Operations can mark the vehicle as "Released" with confirmation button when the vehicle is fetched/retrieved by the client. Upon confirmation, the job order is automatically transferred to Job History.
- Notifications Badge – Displays count of new status changes on dashboard.

**Service Management Module** – Add, edit, and archive services with workflow stages.

- Add Service – Create service with name, description, duration, and defined workflow satges categorized as preparation (for detailers) and installation (for installers).
- Edit Service – Update service details and workflow stages including stage duration.
- Archive Service – Remove service from active list without permanent deletion.

**Concerns Module** – Receive and resolve concerns submitted by Head Detailer and Head Installer.

- Notifications Badge – Displays count of new concerns on dashboard.
- Concerns Inbox – List of all concerns with job reference, submitter (Head Detailer/Head Installer), title, description, submission timestamp.
- Resolve Concern – Mark concern as Resolved with optional response note visible to submitter.

**Techncian Availability Module** - Simple availability status toggle for detailer team members.

- Technician List – List of detailer team members with Available/Unavailable toggle for each.
- Real-time Status – Indicates current availability status of each team member for job assignment purposes.

**Job Order Records** – Historical archive of completed jobs; full history log with filter, search, and export.

- View Job History – Complete log of status changes, stage updates, team assignments, photo and video documentation with timestamps. Contains only completed job orders that have been marked as "Released" by Operations.
- Automatic Transfer – Job orders are automatically transferred to Job History once Operations confirms the "Released" status.
- Filter and Search – Filter by date range, service type, status, assigned technician; search by customer name or plate number.
- Export – Export in PDF and Excel formats.

---

### Sales Role Modules
**Inquiry Management Module** – Displays customer conversations requiring human intervention.

- Escalation List – Displays flagged conversations with the following information:
  - Messenger Name – Customer's Facebook Messenger display name
  - Time Elapsed – Duration since the conversation was escalated (e.g., "2 hours ago", "1 day ago")
  - Escalation Date – Date and time when the conversation was flagged for human response
  - Inquiry Type – Category indicator (Human Response, Report, and Booking)
  - Resolution Status – Button to mark conversation as "Resolved" or "Unresolved"
- Record Customer Details Button – Available for booking inquiries; when pressed on a specific booking inquiry notification, generates a customer record in the Customer Record Module containing the customer details collected during the chatbot conversation. Only enabled once booking is confirmed through manual coordination with the client via Messenger.
- Manual Response – Sales staff responds directly through Facebook Messenger application; the system does not provide conversation viewing or reply functionality.

**Customer Record Module** – Stores and manages confirmed customer details from booking inquiries.

- Customer Record Generation – Customer records are created when Sales presses "Record Customer Details" button on a specific booking inquiry notification in the Inquiry Management Module. This action generates a customer record containing the customer details that were collected during the chatbot messenger conversation.
- Trigger Condition – Customer record is only generated once booking is confirmed through manual human discussion between Sales and the client via Messenger.
- Stored Information – Full name, contact number, plate number, vehicle unit, and associated Page-Scoped ID (PSID) from Messenger.
- Purpose for Operations – Enables autofill functionality of customer details when creating job orders in the Job Management Module.
- Purpose for Chatbot Integration – Connects the customer's PSID with their plate number and contact details, allowing the chatbot to provide automatic vehicle status updates to the correct customer.
- Search and Filter – Search by customer name, plate number, contact number, or email.
- Edit Customer Record – Update customer details (except PSID) or vehicle information.
- View Customer Record – Display full customer information and associated booking history.

---

### Internal Staff Side – Web Mobile Interface (Head Detailer and Head Installer)

**Login Page** – Head Detailers and Head Installers log in using credentials created by the Admin.

Both Head Detailer and Head Installer share an identical modular structure with role-based data filtering, accessed via a mobile-optimized navigation system designed for one-handed operation on the shop floor.

---

### Head Detailer Role Modules

The Head Detailer holds supervisory authority over the preparation phase of all assigned jobs and is responsible for approving preparation completion before handoff to the installation team.

**Dashboard** – Real-time overview of assigned preparation jobs.

- Active Jobs Overview – Displays all jobs with assigned detailer team in card-based layout.
- Job Card View – Customer name, vehicle information, service type, scheduled date, current status, progress indicator.
- Filter and Sort – Filter by status or date for easier monitoring.
- Card Navigation – Clicking a job order card navigates to the Service Stage Progression Module for that specific job.

**Service Stage Progression Module** – Primary working function for preparation stages.

- Stage Checklist View – Displays all preparation stages for the assigned service in sequence.
- Mark Stage as Done – Completes current stage with automatic timestamp.
- Photo and Video Upload per Stage – Required documentation for each preparation stage. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- Approve Preparation Completion – Marks all preparation stages complete with optional handoff notes for Head Installer.
- Flag Preparation for Rework – Select specific preparation stages requiring rework, provide written rework instructions, revert selected preparation stages to "In Progress."
- Scope Limitation – Can only flag preparation stages.

**Concern Submission Module** – Report job-related issues to Operations.

- Access via Bottom Navigation – Concern submission accessible through dedicated bottom navigation tab.
- Manual Entry – Head Detailer manually enters concern title and description text fields.
- Concern Title – Required text field for brief concern summary.
- Concern Description – Required text field for detailed explanation.
- Optional Photo/Video Attachment – Head Detailer can optionally attach photos or videos to the concern. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- Media Sharing – Attached photos and videos are stored with shareable links that Operations can manually distribute if needed.
- Submit to Operations – Sends concern to Operations dashboard with automatic notification.
- View Submitted Concerns – Read-only view of own submitted concerns with status (Pending/Resolved) and Operations response notes.
---

### Head Installer Role Modules

The Head Installer holds supervisory authority over the installation phase of all assigned jobs and is responsible for conducting the final quality check before vehicle release.

**Dashboard** – Real-time overview of assigned installation jobs.

- Active Jobs Overview – Displays all jobs with assigned installer team in card-based layout.
- Job Card View – Customer name, vehicle information, service type, scheduled date, current status, progress indicator.
- Filter and Sort – Filter by status or date for easier monitoring.
- Handoff Notifications – Visual indicator for newly received jobs from Head Detailer.
- Card Navigation – Clicking a job order card navigates to the Service Stage Progression Module for that specific job.

**Service Stage Progression Module** – Primary working function for installation stages.

- View Preparation Handoff Notes – Read-only summary of handoff notes from Head Detailer when beginning installation work.
- Stage Checklist View – Displays all installation stages for the assigned service in sequence.
- Mark Stage as Done – Completes current stage with automatic timestamp.
- Photo and Video Upload per Stage – Required documentation for each installation stage. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- Final Quality Check and Approval – When the last installation stage is completed, approve the job as Completed or flag for rework.
- Flag Installation for Rework – Select specific installation stages requiring rework, provide written rework instructions, revert selected installation stages to "In Progress."
- Scope Limitation – Can only flag installation stages.

**Concern Submission Module** – Report job-related issues to Operations.

- Access via Bottom Navigation – Concern submission accessible through dedicated bottom navigation tab.
- Manual Entry – Head Installer manually enters concern title and description text fields.
- Concern Title – Required text field for brief concern summary.
- Concern Description – Required text field for detailed explanation.
- Optional Photo/Video Attachment – Head Installer can optionally attach photos or videos to the concern. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- Media Sharing – Attached photos and videos are stored with shareable links that Operations can manually distribute if needed.
- Submit to Operations – Sends concern to Operations dashboard with automatic notification.
- View Submitted Concerns – Read-only view of own submitted concerns with status (Pending/Resolved) and Operations response notes.

---

### Messenger AI Chatbot Integration

The system integrates with the company's official Facebook Page via the Meta Messenger Platform API, enabling automated customer interaction through an AI chatbot powered by Gemini.

**AI Chatbot (Gemini API)**

- Scope of AI Responses – The AI is configured to respond to company-related inquiries such as services and pricing, business hours and location, general detailing FAQs, and vehicle status updates.
- Default Quick Reply Options – Upon opening the chatbot, customers are presented with predefined quick reply buttons for the most common inquiry categories. (e.g., Services and Prices, Booking, Report Concern)
- Customer Detail Collection for Booking – When customers express booking intent, the chatbot collects and records required customer information including full name, contact number, plate number, and vehicle unit. - These details are temporarily stored and associated with the customer's Page-Scoped ID (PSID) until the booking is confirmed.
- Automated Vehicle Status Updates – The AI chatbot automatically provides status updates each stage progression and returns the current documentation and status in real-time. The attachment is sent and accessible as a link.
- Escalation Triggers – The conversation is automatically flagged for human assistance when the AI cannot provide a relevant answer, when manual intervention is requested, when booking details are collected, or when verification fails.
- Human Handover – Once escalated, Sales opens the full chat thread including all prior AI responses and replies directly through Messenger. The conversation status updates upon Sales response.

---

## Limitations of the Project
**No Automated Booking and Appointment Scheduling** – The system does not include an automated booking or appointment scheduling feature. While customers may express their intent to book a service through the Messenger chatbot, the chatbot itself does not process, confirm, or finalize any booking. Inquiries or requests regarding booking made through the chatbot will be escalated to Sales, who will then coordinate directly with the customer to confirm the details and manually create the corresponding job order record within the system.

**Chatbot Functionality and AI Response Accuracy** – The Messenger AI chatbot provides general company-related inquiries and automated vehicle status updates by connecting PSID to given customer/vehicle detains in Messenger. The accuracy of the chatbot's responses is dependent on the completeness and quality of its system prompt configuration and knowledge base managed by the Admin. Incomplete or outdated information may result in inaccurate or unhelpful responses. The chatbot cannot access internal operational data beyond job status information required for status update verification.

**Messenger-Based Communication and Update Restrictions** – Automatic vehicle status updates are restricted to customers who booked through Facebook Messenger, operating on a strict one-to-one account basis where only the specific Messenger account used for booking receives updates. 

**Messenger Account Security** – The system's customer-facing communication operates entirely through Facebook Messenger, which is subject to Meta's own platform security policies and is outside the direct control of the proposed system. The system cannot prevent or mitigate security incidents originating from the customer's side, including but not limited to account hacking or unauthorized access, device theft resulting in compromised account access, or loss of communication capability due to destroyed or damaged devices. 

**No Online Payment Processing and Sales-Related Features** – The system does not support online payment transactions. Payment details such as downpayment amounts and remaining balances are recorded and tracked manually by Sales outside the system. Furthermore, the system does not include any sales-related features such as revenue tracking, sales reporting, or financial summaries.

**Limited to Active Service Lifecycle Processes** – The system is designed to manage vehicle service operations strictly within the active service period, beginning from job order creation and ending upon the release of the vehicle to the customer. Pre-service processes such as contract signing, initial vehicle inspection, and visual condition checking prior to service commencement are not facilitated within the system. Similarly, post-service processes such as refund processing, warranty claims, or after-service follow-ups are outside the scope of the system.

**No Documentation Quality Validation for Documentation and Performance Tracking** – The system does not validate the accuracy, relevance, or quality of photos and videos uploaded during service stage progression, accepting media files based solely on file format and size requirements without verifying content appropriateness. Additionally, the system tracks job assignments and service completions at the team level only and does not monitor individual technician performance metrics, productivity data, or work quality assessments for specific Installer or Detailer personnel.

---

**Document Version:** v6.0  
**Last Updated:** April 2026  
**Status:** Final Draft for Capstone Development
