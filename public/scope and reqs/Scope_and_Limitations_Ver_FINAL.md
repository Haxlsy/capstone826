# Scope and Limitations

This study focuses on the development and implementation of a web-based service management system specifically for the Cainta branch of 826 Auto Care OPC. The system is designed to streamline automotive care operations through digitized job order processing, real-time service stage tracking, and automated customer communication via an AI-powered chatbot integrated with Facebook Messenger. The project targets internal staff members including Operations, Sales, Head Detailer, and Head Installer; as well as customers who interact with 826 Auto Care OPC Cainta's official Facebook Messenger platform. The development period spans from the initial requirements gathering phase through system deployment and testing at the Cainta branch location.

---

## Scope of the Project

### Internal Staff Side – Web Page (Super Admin, Admin, Operations, Sales)

**Login Page** – Role-based login for all internal staff users. One initial Super Admin account is provided by the system developers. Admin accounts are created exclusively by the Super Admin. All other internal accounts are created by both Super Admin or Admin.

---

### Super Admin

The Super Admin holds all functions of the Admin role and is additionally granted exclusive authority over Admin account management.

**Admin Account Management Module** – Accessible to the Super Admin; enables creation, editing, and archiving of Admin accounts.

- Add Admin Account – Create login credentials for a new Admin user.
- Edit Admin Account – Modify Admin user details such as full name and reset password.
- Archive Admin Account – Deactivate an Admin account while preserving its records.
- Search and Filter – Search Admin accounts by name or username and filter by status.

---

### Admin

The Admin manages all non-Admin internal user accounts and all system-wide configuration modules. Admin cannot create or modify Admin or Super Admin accounts.

**Account Management Module** – Enables creation, editing, and archiving of internal staff accounts for Operations, Sales, Head Detailer, and Head Installer roles.

- Add User Account – Enter full name; username and password are auto-generated; select user role.
- Edit User Account – Modify full name or reset account password.
- Archive/Unarchive User Account – Deactivate or reactivate an account while preserving its records.
- Search and Filter – Search accounts by name or username; filter by role and status.

**Service Management Module** – Enables full lifecycle management of the service catalog.

- Manage Service Types – Add or remove service type classifications.
- Manage Category Presets – Add, edit, or delete category stages by entering the category stage name, selecting the associated technician role, and defining workflow stages and stage durations in HH/MM format.
- Add Service – Select service type; enter title and description; select stage categories; define workflow stages and stage durations.
- Edit Service – Modify an existing service's title, description, workflow stages, and stage categories.
- Archive/Unarchive Service – Remove a service from the active list without permanent deletion.
- Search and Filter – Search services by name; filter by service type, status, and duration.

**AI Chatbot Management Module** – Enables configuration of all chatbot behavior, knowledge base, and automated notification templates.

- Chatbot Settings:
  - Enable or disable the Messenger-integrated AI chatbot via a toggle control.
  - Enable or disable Gemini API media validation via a toggle control.
  - Select chatbot tone: Friendly and Professional, Formal and Concise, or Casual and Conversational.
  - Toggle specific chatbot response topics: services and pricing, booking information extraction, vehicle status update, and general FAQ.
  - Enable or disable Sales notification when a booking request is received through the chatbot.
  - Select chatbot language: English, Filipino, or both.
  - Configure escalation triggers that determine when conversations are handed over to Sales.
- Knowledge Base Management – Add, edit, or remove knowledge base entries by category, question or topic, and corresponding answer.
- Automated Update Message Template – Input and save a message template used for automated vehicle status update notifications sent through Messenger.

---

### Operations

Operations manages the full vehicle service workflow through a web-based interface.

**Job Order Module** – Central interface for job order creation, status monitoring, technician assignment, rework flagging, release marking, and completion processing.

- Create Job Order – Enter customer and vehicle information manually or auto-fill from the Customer Record; select service type; select scheduled start date and time; assign detailers and installers with their respective Head Detailer and Head Installer.
- View Job Order Details – Monitor service status, stage progression, assigned technicians, timeline, expected completion date, and uploaded photo and video documentation.
- Substitute Technician – Replace an assigned technician within an active job order.
- Flag Stage for Rework – Select a specific stage and enter written rework instructions to revert the stage to In Progress.
- Mark as For Release – Update the job order status to "For Release" upon final inspection approval.
- Mark as Completed – Confirm vehicle retrieval and complete the job order, automatically archiving it with full service history.
- Search and Filter – Search by customer name, plate number, vehicle unit, or service type; filter by status and date range.
- Export – Export job records in PDF and Excel formats.

**Technician Management Module** – Manages technician records and availability status.

- Add Technician – Enter technician name, select role, select available schedules, and define working hours.
- Edit Technician – Modify technician name, role, or available schedules.
- Remove Technician – Delete a technician record from the active list.
- Toggle Availability – Set individual technicians to Available or Unavailable.
- Search and Filter – Search by name; filter by role.

**Concerns Management Module** – Handles concerns submitted by Head Detailer and Head Installer.

- View Concerns – Display all submitted concerns showing submitter, associated job, concern title, description, and submission timestamp.
- Resolve Concern – Mark a concern as Resolved with an optional written response note visible to the submitter.
- Search and Filter – Search by submitter name or description; filter by status and date range; segmented views for Pending, Resolved, and All.
- Notification Badge – Displays the count of newly submitted unread concerns.

**Job Records Module** – Read-and-export interface for completed job order data.

- View Job Records – Display list of archived completed job orders.
- Export – Filter records by date range and export in PDF or Excel format.

---

### Sales

Sales manages escalated customer inquiries and maintains the customer record.

**Inquiry Management Module** – Centralized interface for escalated conversations from the AI chatbot.

- Inquiry List – Display escalated customer conversations showing Messenger display name, time elapsed since escalation, escalation date, inquiry tag (Booking, Human Response, or Report), and resolution status.
- Summary Counts – Display counts for Total, Unrecorded, Recorded, Unresolved, and Resolved inquiries.
- View Inquiry Details – Display full inquiry details including Messenger display name, escalation date and time, Page-Scoped ID, and, where available, plate number, vehicle unit, contact number, and email.
- Generate Customer Record – Transfer and save collected booking details (full name, contact number, plate number, vehicle unit, email, and Page-Scoped ID) into the Customer Record module.
- Mark as Resolved – Update inquiry status to Resolved.
- Search and Filter – Search by customer name; filter by status; segmented views for Unrecorded, Recorded, Unresolved, and Resolved.

**Customer Record Module** – Stores and manages confirmed customer details collected from inquiries.

- Stored Information – Page-Scoped ID (PSID) from Messenger, full name, plate number, vehicle unit, contact number, and email.
- Edit Customer Record – Update all customer fields except the Page-Scoped ID.
- Search – Search by customer name, plate number, vehicle unit, contact number, or email.
- Export – Export customer records in PDF and Excel formats, with optional date range filtering.

**Read-Only Access** – Sales may view the following in read-only mode:

- Job Order Details – Current status, stage progression, automated update delivery status, assigned technicians, timeline, expected completion date, and uploaded media.
- Concerns – Concerns submitted by Head Detailer and Head Installer, along with Operations response notes.

---

### Internal Staff Side – Web Mobile Interface (Head Detailer and Head Installer)

Both Head Detailer and Head Installer share an identical modular structure with role-based data filtering, accessed via a web mobile-optimized navigation system.

**Login Page** – Head Detailers and Head Installers log in using credentials created by the Admin.

#### Head Detailer

The Head Detailer holds supervisory authority over the detailer phase of all assigned jobs and is responsible for approving completion before handoff to the next team.

**Assigned Jobs Module** – Real-time overview of assigned preparation jobs.

- Summary Cards – Display job counts: Total, Ongoing, Rework, and Delayed.
- Job Card View – Display assigned detailer team, customer name, vehicle information, service type, scheduled date, current status, and stage progress indicator.
- Search and Filter – Search by customer name, plate number, vehicle unit, or service type; filter by status.

**Service Stage Progression Module** – Primary working function for detailer stages.

- View Handoff Notes – Read-only summary of handoff notes passed from the previous team.
- Sequential Stage Display – All assigned detailer stages displayed in sequential order.
- Upload Media per Stage – Upload at least one photo or video per stage before marking it complete. Accepted formats: JPG, JPEG, PNG (maximum 5 MB per file) for photos; MP4, MOV (maximum 50 MB per file) for videos.
- Enter Stage Note – Enter a written note per stage after uploading media and before marking the stage complete.
- Media Validation (Gemini API) – Automatically validates uploaded photos and videos; prompts the Head Detailer to retake media if content is detected as non-vehicle, blurry, or unclear.
- Mark Stage Complete – Records completion timestamp and automatically triggers a vehicle status update with corresponding media sent to the customer through the Messenger chatbot.
- Flag Stage for Rework – Select specific stages, enter written rework notes, and revert selected stages to In Progress.
- Approve All Stages – Approve all detailer stages as complete with optional handoff notes, advancing the job to the next team.

**Concern Submission Module** – Direct communication channel to Operations for operational issues.

- Submit Concern – Select the relevant job order and stage, enter a title and description, and optionally attach photos or videos.
- View Concern Feedback – View the status and Operations response notes for submitted concerns in read-only mode.

---

#### Head Installer

The Head Installer holds supervisory authority over the installation phase of all assigned jobs and is responsible for approving completion and triggering the "For Release" status.

**Assigned Jobs Module** – Real-time overview of assigned installation jobs.

- Summary Cards – Display job counts: Total, Ongoing, Rework, and Delayed.
- Job Card View – Display assigned installer team, customer name, vehicle information, service type, scheduled date, current status, and stage progress indicator.
- Search and Filter – Search by customer name, plate number, vehicle unit, or service type; filter by status.

**Service Stage Progression Module** – Primary working function for installation stages.

- Sequential Stage Display – All assigned installation stages displayed in sequential order.
- Upload Media per Stage – Upload at least one photo or video per stage before marking it complete. Accepted formats: JPG, JPEG, PNG (maximum 5 MB per file) for photos; MP4, MOV (maximum 50 MB per file) for videos.
- Enter Stage Note – Enter a written note per stage after uploading media and before marking the stage complete.
- Media Validation (Gemini API) – Automatically validates uploaded photos and videos; prompts the Head Installer to retake media if content is detected as non-vehicle, blurry, or unclear.
- Mark Stage Complete – Records completion timestamp and automatically triggers a vehicle status update with corresponding media sent to the customer through the Messenger chatbot.
- Flag Stage for Rework – Select specific stages, enter written rework notes, and revert selected stages to In Progress.
- Approve All Stages – Approve all installation stages as complete with optional handoff notes, advancing the job to the next team and triggering the "For Release" status upon final stage completion.

**Concern Submission Module** – Direct communication channel to Operations for operational issues.

- Submit Concern – Select the relevant job order and stage, enter a title and description, and optionally attach photos or videos.
- View Concern Feedback – View the status and Operations response notes for submitted concerns in read-only mode.

---

### Customer Side – Facebook Messenger (AI Chatbot)

Customers interact with the system exclusively through 826 Auto Care OPC Cainta's official Facebook Messenger platform.

**AI Chatbot (Gemini API)**

- Scope of AI Responses – The AI is configured to respond to company-related inquiries such as services and pricing, business hours and location, general detailing FAQs, and vehicle status updates.
- Default Quick Reply Options – Upon opening the chatbot, customers are presented with predefined quick reply buttons for the most common inquiry categories (e.g., Services and Prices, Booking, Report Concern, Vehicle Status Update).
- Customer Detail Collection for Booking – When customers express booking intent, the chatbot collects and records the given customer information including full name, contact number, plate number, vehicle unit, and email. These details are temporarily stored and associated with the customer's Page-Scoped ID (PSID) until the booking is confirmed.
- Automated Vehicle Status Updates – The AI chatbot automatically sends a status update and corresponding media to the customer through Messenger each time a service stage is marked complete.
- Status Update Request/Customer Verification – Customers may request a vehicle status update through the chatbot at any time. Customers who did not use Messenger to initiate their booking must verify their identity by providing the vehicle plate number and associated phone number before receiving status updates.
- Escalation Triggers – The conversation is automatically flagged for human assistance when the AI cannot provide a relevant answer, when manual intervention is requested, when booking details have been fully collected, or when identity verification fails. The escalation is flagged to the Inquiry Management Module in Sales.

**Media Validation (Gemini API)**

- Photo/Video Validation – Gemini automatically analyzes captured photos and videos submitted by Head Detailer and Head Installer to determine whether the content contains a valid vehicle and meets quality standards. If the media is detected as non-vehicle content or is of low quality (e.g., blurry or unclear), the system prompts the user to retake the photo or video before proceeding.

---

## Limitations of the Project

- **No Automated Booking and Appointment Scheduling** – The system does not process, confirm, or finalize bookings. Booking inquiries through the Messenger chatbot are escalated to Sales for manual coordination and job order creation.

- **Chatbot Functionality and AI Response Accuracy** – The Messenger AI chatbot's response accuracy depends on the completeness and quality of the chatbot's setting configuration and knowledge base. Incomplete or outdated information may result in inaccurate responses. The chatbot accesses only job status information and cannot retrieve other internal operational data.

- **Messenger-Based Communication Restrictions** – Automatic vehicle status updates are limited to the specific Messenger account used during initial contact, operating on a strict one-to-one account basis.

- **Messenger Account Security** – The system relies on Facebook Messenger, which is governed by Meta's platform security policies. The system cannot prevent or mitigate customer-side security incidents including account hacking, unauthorized access, device theft, or loss of communication capability.

- **No Online Payment Processing and Sales-Related Features** – The system does not support online payment transactions. Payment details are recorded manually by Sales outside the system. Sales-related features such as revenue tracking, sales reporting, and financial summaries are not included.

- **Limited to Active Service Lifecycle Processes** – The system manages operations only from job order creation to vehicle release. Pre-service processes such as contract signing and initial vehicle inspection, as well as post-service processes such as refund processing, warranty claims, and after-service follow-ups are excluded.
