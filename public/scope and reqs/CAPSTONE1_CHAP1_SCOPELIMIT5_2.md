# Scope and Limitations

*STI College Ortigas-Cainta*

This study focuses on the development and implementation of a web-based service management system specifically for the Cainta branch of 826 Auto Care OPC. The system is designed to streamline automotive care operations through digitized job order processing, real-time service stage tracking, and automated customer communication via an AI-powered chatbot integrated with Facebook Messenger. The project targets internal staff members including Operations, Sales, Head Detailer, and Head Installer roles; as well as customers who interact with 826 Auto Care OPC Cainta's official Facebook Messenger platform. The development period spans from the initial requirements gathering phase through system deployment and testing at the Cainta branch location.

---

## Scope of the Project

### Internal Staff Side – Web Page (Super Admin, Operations, Sales)

#### Login Page

Role-based login for all internal staff users. One initial Super Admin account is provided by the system developers. Admin accounts are created exclusively by the Super Admin. All other internal accounts are created by both Super Admin or Admin.

---

### Super Admin

The Super Admin holds all functions of the Admin role and is additionally granted exclusive authority over Admin account management.

#### Admin Account Management Module

Accessible to the Super Admin; enables creation, editing, and archiving of Admin accounts.

- **Add Admin Account** – Create login credentials for a new Admin user.
- **Edit Admin Account** – Modify Admin user details such as full name and reset password.
- **Archive Admin Account** – Deactivate an Admin account while preserving records for reference.
- **Filter and Search** – Filter by role and status; search by name and username.

---

### Admin

The Admin holds full system management authority over all non-Admin internal accounts and system configuration, but cannot create, edit, or archive Admin or Super Admin accounts.

#### Dashboard

System overview of active accounts, login/log out attempts, and audit trail of user activities within the system.

- **Summary Cards** – Counts: Total Accounts, Total Services, Active Customer Record.
- **Login/Log out Attempts** – Display date and time of login/log out within the system.
  - *Filter* – Filter by role and logged in/logged out.
- **Audit Trail** – Display date and time of activities within the system.
  - *Filter* – Filter by role and actions: password reset, view, create, update, approve, flag/rework, delete/archive, and message.

#### Account Management Module

Enables creation, editing, and archiving of all internal user accounts: Operations, Sales, Head Detailer, and Head Installer.

- **Add User Account** – Create login credentials for internal staff.
- **Edit User Account** – Modify user details such as full name and reset password.
- **Archive User Account** – Deactivate an internal staff account while preserving records.
- **Filter and Search** – Filter by role and status; search by name and username.

#### Service Management Module

Add, edit, and archive services with workflow stages.

- **Add Service** – Select or enter service type, enter title and description, define workflow and category stages for available technician roles, and set workflow stages duration.
- **Edit Service** – Modify service details, workflow and category stages.
- **Archive Service** – Remove service from active list without permanent deletion.
- **Filter and Search** – Filter by service type, status and duration; search by service name.

#### AI Chatbot Management Module

Configure and manage the AI chatbot's knowledge base and instructions.

- **Update Chatbot Instructions** – Add and modify the system prompt and conversation guidelines that control the chatbot's responses to customer inquiries.
- **Manage Chatbot Knowledge Base** – Add and modify information about services, pricing, business hours, vehicle status message template, and frequently asked questions that the chatbot uses to respond to customers.
- **Configure Vehicle Status Message Template** – Add and modify automated vehicle status message sent to customers.

---

### Operations

#### Dashboard

Real-time overview with job status summary cards and Job Calendar View.

- **Summary Cards** – Job counts by status: Pending, Ongoing, For Rework, For Inspection, For Release, Delayed, and Concerns.
- **Job Calendar View** – All scheduled jobs in calendar format.
- **Quick Access** – Shortcuts to recent jobs and flagged concerns.

#### Job Order Module

Create, edit, and assign job orders.

- **Create Job Order** – Auto-fill customer information (full name, contact number, and email) and vehicle information (plate number and unit) from Sales customer record or manual input if not booked through Messenger. Select service type, set actual service start date, assign detailers, installers, and single head detailer and head installer.
  - *Service Quick Edit* – Allows modifications to selected service type's title, description, and workflow stages within the job order.
- **Edit Job Order** – Modify assigned technicians and scheduled date/time. Customer and vehicle details are only modified by Sales in Customer Record. Scheduled date/time cannot be modified once started by technician.
- **View Details** – Display current status, service stage progression, auto-update status (successfully sent/unsuccessful updates), assigned technicians, scheduled timeline, expected completion date, photo and video documentation.
  - *Resend Status Update* – Clickable "resend update" in service stage progression for error/unsuccessful updates.
  - *Flag Preparation for Rework* – Once the job order reaches the inspection stage, Operations can select installer and detailer stage to flag for rework, provide written rework notes, revert selected preparation stages to "In Progress" in the Head Technician side.
  - *Update to For Release Status* – After passing quality inspection check, the Operations can mark the vehicle as "For Release" notifying the client that the vehicle is now available for retrieval.
  - *Update to Completed Status* – Once job order reaches "For Release" status, Operations can mark the vehicle as "Completed" when all service stages are finalized or the vehicle is retrieved by the client. Upon confirmation, the job order is automatically transferred to Job Record.
- **Filter and Search** – Filter by status; search by customer, plate number, vehicle unit, and Job Order ID.
- **Segmented Control** – View arranged by Pending, Ongoing, For Rework, For Inspection, For Release, and Delayed.
- **Notifications Badge** – Displays count of new status changes.

#### Job Records Module

Historical archive of completed jobs; full history log with filter, search, and export.

- **View Job History** – Complete log of status changes, stage updates, technician assignments, photo and video documentation with timestamps. Contains only completed job orders that have been marked as "Completed" by Operations.
- **Filter and Search** – Filter by date range, search by customer name, service type, plate number, vehicle unit, head technician, and job ID.
- **Export** – Export in PDF and Excel formats.

#### Technician Availability Module

Availability list and status toggle for technician members.

- **Summary Cards** – Technician counts: Total, Available, On Job, and Unavailable.
- **Technician List** – List of detailers and installers with Available/Unavailable toggle for each.
- **Technician Management** – Create and edit technician details.
  - *Add Technician* – Add technician name, select technician role, select available schedules.
  - *Edit Technician* – Modify technician details and select technician role.
  - *Delete Technician* – Remove technician from available list.
- **Bulk Status Update** – Set all technician status to "Unavailable/Available".
- **Real-time Status** – Indicates current availability status of each team member for job assignment purposes.
- **Filter and Search** – Filter by role; search by technician.

#### Concerns Management Module

Receive and resolve concerns submitted by Head Detailer and Head Installer.

- **View Details** – Display submitter (Head Detailer/Head Installer), title, description, submission timestamp.
  - *Resolve Concern* – Mark concern as Resolved with optional response note visible to submitter.
- **Filter and Search** – Filter by status and date range; search by head technician, and other descriptions.
- **Segmented Control** – View arranged by Pending, Resolved, and All, For Release.
- **Notifications Badge** – Displays count of new concerns.

#### View Service Catalog (Read-Only)

From Admin; display available services including details and stages.

---

### Sales

#### Inquiry Management Module

Displays list of customer conversations requiring human intervention.

- **Summary Cards** – Customer counts: Total, Unrecorded, Recorded, Unresolved, and Resolved.
- **Escalation List** – Displays flagged conversations with the following information:
  - *Messenger Name* – Customer's Facebook Messenger display name.
  - *Time Elapsed* – Duration since the conversation was escalated (e.g., "2 hours ago", "1 day ago").
  - *Escalation Date* – Date and time when the conversation was flagged for human response.
  - *Inquiry Tags* – Category indicator (Human Response, Report, and Booking).
  - *Resolution Status* – Indicates inquiry as Unresolved/Resolved.
- **View Details** – Display customer name, escalation date and time, Page-Scoped Identification (PSID), and when available: plate number, vehicle unit, contact number, and email.
  - *Record Customer Details* – Available once customer booking details are complete; transfers and generates a customer record in the Customer Record Module containing the customer details (Page-Scoped ID [PSID] from Messenger, full name, plate number, vehicle unit, contact number, and email) collected during the chatbot conversation.
  - *Inquiry Status Update* – Button to mark conversation as Resolved by Sales.
- **Manual Response** – Sales staff responds directly through Facebook Messenger application; the system does not provide conversation viewing or reply functionality.
- **Search** – Search by customer name.
- **Segmented Control** – View arranged by status: Unrecorded, Recorded, Unresolved, and Resolved.

#### Customer Record Module

Stores and manages confirmed customer details from inquiries.

- **Customer Record Generation** – Customer records are created when Sales transfers and generates customer information collected from Inquiry Management Module that were collected during the chatbot Messenger conversation.
- **Stored Information** – Page-Scoped ID (PSID) from Messenger, full name, plate number, vehicle unit, contact number, and email.
- **Purpose for Operations** – Enables autofill functionality of customer details when creating job orders in the Job Management Module. Manually entered customer information in Operations is generated in Customer Record for connecting to client once vehicle status update is requested in Messenger.
- **Purpose for Chatbot Integration** – Connects the customer's PSID with their plate number and contact details, allowing the chatbot to provide automatic vehicle status updates to the correct customer.
- **Search** – Search by customer name, plate number, vehicle unit, contact number, or email.
- **Edit Customer Record** – Update customer details (except PSID) or vehicle information.
- **Export** – Export in PDF and Excel formats.

#### View Job Order (Read-Only)

From Operations; display current status, service stage progression, auto-update status (successfully sent/unsuccessful updates), assigned technicians, scheduled timeline, expected completion date, photo and video documentation.

#### View Concerns (Read-Only)

From Operations; display concerns submitted by Head Detailer and Head Installer and Operations responses and resolutions.

---

### Internal Staff Side – Web Mobile Interface (Head Detailer and Head Installer)

Both Head Detailer and Head Installer share an identical modular structure with role-based data filtering, accessed via a mobile-optimized navigation system.

#### Login Page

Head Detailers and Head Installers log in using credentials created by the Admin.

---

### Head Detailer

The Head Detailer holds supervisory authority over the detailer phase of all assigned jobs and is responsible for approving completion before handoff to next team.

#### Summary Cards

Job counts: Total, Ongoing, Rework, and Delayed.

#### Assigned Jobs

Real-time overview of assigned preparation jobs.

- **Job Card View** – Assigned detailer team, customer name, vehicle information, service type, scheduled date, current status, progress indicator.
- **Filter and Search** – Filter by status; searched by customer name, plate number, vehicle unit, and service type.
- **Card Navigation** – Clicking a job order card opens the individual service stage progression.

#### Service Stage Progression

Primary working function for detailer stages.

- **View Preparation Handoff Notes** – Read-only summary of handoff notes from previous team.
- **Stage Checklist View** – Displays all detailer stages for the assigned service in sequence.
- **Photo and Video Upload per Stage** – Required documentation for each installation stage. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
  - *Photo/Video Validation* – Gemini automatically analyzes the captured photo or video and prompts to retake when an invalid content (non-vehicle, blurry or unclear) is taken.
- **Technician Note** – Required notes per stage progression after photo/video documentation.
- **Mark Stage as Done** – Completes current stage with automatic timestamp.
  - *Automated Vehicle Status Updates* – Once marked as done, status and photo/video is sent by Gemini chatbot to client on Messenger.
- **Approve Completion** – Marks all detailer stages complete with optional handoff notes and advances progress to next team.
- **Flag for Rework** – Select specific stages requiring rework, provide written rework notes, and revert selected stages to "In Progress."

#### Concern Submission

Report job-related issues to Operations.

- **Submit Concern** – Head Detailer selects job order, stage and enters description text fields with optional photos or videos submitted to Operations. Supported media format: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- **View Submitted Concerns** – Read-only view of own submitted concerns with status (Pending/Resolved) and Operations response notes.

---

### Head Installer

The Head Installer holds supervisory authority over the installer phase of all assigned jobs and is responsible for approving completion before handoff to next team.

#### Summary Cards

Job counts: Total, Ongoing, Rework, and Delayed.

#### Assigned Jobs

Real-time overview of assigned installer jobs.

- **Job Card View** – Assigned installer team, customer name, vehicle information, service type, scheduled date, current status, and progress indicator.
- **Filter and Search** – Filter by status; searched by customer name, plate number, vehicle unit, and service type.
- **Card Navigation** – Clicking a job order card opens the individual service stage progression.

#### Service Stage Progression

Primary working function for installer stages.

- **View Preparation Handoff Notes** – Read-only summary of handoff notes from previous team.
- **Stage Checklist View** – Displays all installer stages for the assigned service in sequence.
- **Photo and Video Upload per Stage** – Required documentation for each installation stage. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
  - *Photo/Video Validation* – Gemini automatically analyzes the captured photo or video and prompts to retake when an invalid content (non-vehicle, blurry or unclear) is taken.
- **Technician Note** – Required notes per stage progression after photo/video documentation.
- **Mark Stage as Done** – Completes current stage with automatic timestamp.
  - *Automated Vehicle Status Updates* – Once marked as done, status and photo/video is sent by Gemini chatbot to client on Messenger.
- **Approve Completion** – Marks all installer stages complete with optional handoff notes and advances progress to next team.
- **Flag for Rework** – Select specific stages requiring rework, provide written rework notes, and revert selected stages to "In Progress."

#### Concern Submission

Report job-related issues to Operations.

- **Submit Concern** – Head Installer selects job order, stage and enters description text fields with optional photos or videos submitted to Operations. Supported media format: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- **View Submitted Concerns** – Read-only view of own submitted concerns with status (Pending/Resolved) and Operations response notes.

---

### Messenger AI Chatbot Integration

The system integrates with the company's official Facebook Page via the Meta Messenger Platform API, enabling automated customer interaction through an AI chatbot powered by Gemini.

#### AI Chatbot (Gemini API)

- **Scope of AI Responses** – The AI is configured to respond to company-related inquiries such as services and pricing, business hours and location, general detailing FAQs, and vehicle status updates.
- **Default Quick Reply Options** – Upon opening the chatbot, customers are presented with predefined quick reply buttons for the most common inquiry categories (e.g., Services and Prices, Booking, Report Concern, Vehicle Status Update).
- **Customer Detail Collection for Booking** – When customers express booking intent, the chatbot collects and records the given customer information including full name, contact number, plate number, vehicle unit, and email. These details are temporarily stored and associated with the customer's Page-Scoped ID (PSID) until the booking is confirmed.
- **Automated Vehicle Status Updates** – The AI chatbot automatically provides status updates each stage progression and returns the current documentation and status in real-time.
  - *Status Update Request/Customer Verification* – Customers may request a vehicle status update through the chatbot outside of the automatic updates. Customers who did not use Messenger to book must verify their identity by providing the vehicle plate number and associated phone number before receiving status updates.
- **Escalation Triggers** – The conversation is automatically flagged for human assistance when the AI cannot provide a relevant answer, when manual intervention is requested, when booking details are collected, or when verification fails. The escalation is flagged to the Inquiry Management Module in Sales.

#### Media Validation (Gemini API)

- **Photo/Video Validation** – Gemini automatically analyzes the captured photo or video of the head installer/detailer to determine whether it contains a valid vehicle content and meets quality standards. If the media is detected as non-vehicle content or is of low quality (e.g., blurry or unclear), the system prompts the user to retake the photo or video before proceeding.

---

## Limitations of the Project

- **No Automated Booking and Appointment Scheduling** – The system does not process, confirm, or finalize bookings. Booking inquiries through the Messenger chatbot are escalated to Sales for manual coordination and job order creation.

- **Chatbot Functionality and AI Response Accuracy** – The Messenger AI chatbot's response accuracy depends on the completeness and quality of its system prompt configuration and knowledge base. Incomplete or outdated information may result in inaccurate responses. The chatbot accesses only job status information and cannot retrieve other internal operational data.

- **Messenger-Based Communication Restrictions** – Automatic vehicle status updates are limited to the specific Messenger account used during initial contact, operating on a strict one-to-one account basis.

- **Messenger Account Security** – The system relies on Facebook Messenger, which is governed by Meta's platform security policies. The system cannot prevent or mitigate customer-side security incidents including account hacking, unauthorized access, device theft, or loss of communication capability.

- **No Online Payment Processing and Sales-Related Features** – The system does not support online payment transactions. Payment details are recorded manually by Sales outside the system. Sales-related features such as revenue tracking, sales reporting, and financial summaries are not included.

- **Limited to Active Service Lifecycle Processes** – The system manages operations only from job order creation to vehicle release. Pre-service processes such as contract signing and initial vehicle inspection, as well as post-service processes such as refund processing, warranty claims, and after-service follow-ups are excluded.
