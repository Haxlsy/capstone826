# Scope and Limitations
## STI College Ortigas-Cainta

---

## Overview

This study focuses on the development and implementation of a web-based service management system specifically for the Cainta branch of 826 Auto Care OPC. The system is designed to streamline vehicle detailing and car care operations through digitized job order processing, real-time service stage tracking, and automated customer communication via an AI-powered chatbot integrated with Facebook Messenger. The project targets internal staff members including Sales, Operations, Head Detailer, and Head Installer roles, as well as customers who interact with 826 Auto Care OPC Cainta's official Facebook Messenger platform. The development period spans from the initial requirements gathering phase through system deployment and testing at the Cainta branch location.

---

## Scope of the Project

### Internal Staff Side – Web Page (Super Admin, Operations, Sales)

**Login Page** – Role-based login for all internal staff users. One initial Super Admin account is provided by the system developers. Admin accounts are created exclusively by the Super Admin. All other internal accounts are created by the Admin.

---

### Super Admin

The Super Admin holds all functions of the Admin role and is additionally granted exclusive authority over Admin account management.

#### Admin Account Management Module
Accessible to the Super Admin; enables creation, editing, and archiving of Admin accounts.

- **Add Admin Account** – Create login credentials and a profile for a new Admin user.
- **Edit Admin Account** – Modify Admin user details such as full name and reset password.
- **Archive Admin Account** – Deactivate an Admin account while preserving records for reference.

---

### Admin

The Admin holds full system management authority over all non-Admin internal accounts and system configuration, but cannot create, edit, or archive Admin or Super Admin accounts.

#### Dashboard
System overview with statistics and quick access shortcuts.

#### Account Management Module
Enables creation, editing, and archiving of all internal user accounts: Operations, Sales, Head Detailer, and Head Installer.

- **Add User Account** – Create login credentials and a profile internal staff.
- **Edit User Account** – Modify user details such as full name and reset password.
- **Archive User Account** – Deactivate an internal staff account while preserving records.

#### AI Chatbot Management Module
Configure and manage the AI chatbot's knowledge base and instructions.

- **Update Chatbot Instructions** – Modify the system prompt and conversation guidelines that control the chatbot's responses to customer inquiries.
- **Manage Chatbot Knowledge Base** – Add, edit, or remove information about services, pricing, business hours, and frequently asked questions that the chatbot uses to respond to customers.

---

### Operations

#### Dashboard/Operations Center
Real-time overview with job status summary cards and Job Calendar View.

**Summary Cards:**
- Job counts by status: Pending, Ongoing, For Rework, For Release, Released, Delayed.
- Concern counts

**Job Calendar View** – All scheduled jobs in calendar format.

**Quick Access** – Shortcuts to recent jobs and flagged concerns.

#### Job Management Module
Create, edit, and assign technicians.

- **Create Job Order** – Assign detailers, installers, single head detailer and head installer, select service type, set actual service start date. Auto-fill customer information (full name, contact number, and email) and vehicle information (plate number and unit) from Sales customer record or manual input if not booked through messenger.
- **Edit Job Order** – Modify assigned teams, scheduled date/time, customer details and vehicle information. Scheduled date/time cannot be modified once started by technician.
- **Search** – By customer name, plate number, or job order ID.
- **View Details** – Display current status, service stage progression, auto-update status (successfully sent/unsuccessful updates), assigned teams, scheduled timeline, expected completion date, photo and video documentation.
- **Reflects Current Progress** – Displays real-time documentation and status updates from Head Detailer and Head Installer.
- **Resend Update** – clickable "resend update" in service stage progression for error/unsuccessful updates.
- **Update to Released Status** – Once job order reaches "For Release" status, Operations can mark the vehicle as "Released" with confirmation button when the vehicle is fetched/retrieved by the client. Upon confirmation, the job order is automatically transferred to Job History.
- **Notifications Badge** – Displays count of new status changes on dashboard.

#### Service Management Module
Add, edit, and archive services with workflow stages.

- **Add Service** – Create service with name, description, duration, and defined workflow stages categorized as preparation (for detailers) and installation (for installers).
- **Edit Service** – Update service details and workflow stages.
- **Archive Service** – Remove service from active list without permanent deletion.

#### Concerns Module
Receive and resolve concerns submitted by Head Detailer and Head Installer.

- **Notifications Badge** – Displays count of new concerns on dashboard.
- **Concerns Inbox** – List of all concerns with job reference, submitter (Head Detailer/Head Installer), title, description, submission timestamp.
- **Resolve Concern** – Mark concern as Resolved with optional response note visible to submitter.

#### Technician Availability Module
Simple availability status toggle for detailer team members.

- **Technician Management** – Add, edit, archive installer and detailer.
- **Technician List** – List of detailers and installers with Available/Unavailable toggle for each.
- **Real-time Status** – Indicates current availability status of each team member for job assignment purposes.

#### Job Order Records
Historical archive of completed jobs; full history log with filter, search, and export.

- **View Job History** – Complete log of status changes, stage updates, team assignments, photo and video documentation with timestamps. Contains only completed job orders that have been marked as "Released" by Operations.
- **Automatic Transfer** – Job orders are automatically transferred to Job History once Operations confirms the "Released" status.
- **Filter and Search** – Filter by date range, service type, status, assigned technician; search by customer name or plate number.
- **Export** – Export in PDF and Excel formats.

---

### Sales

#### Inquiry Management Module
Displays list of customer conversations requiring human intervention.

**Escalation List** – Displays flagged conversations with the following information:
- **Messenger Name** – Customer's Facebook Messenger display name
- **Time Elapsed** – Duration since the conversation was escalated (e.g., "2 hours ago", "1 day ago")
- **Escalation Date** – Date and time when the conversation was flagged for human response
- **Inquiry Type** – Category indicator (Human Response, Report, and Booking)
- **Resolution Status** – Button to mark conversation as "Resolved".

**Record Customer Details Button** – Available for booking inquiries; when pressed on a specific booking inquiry notification, generates a customer record in the Customer Record Module containing the customer details collected during the chatbot conversation. Only enabled once booking is confirmed through manual coordination with the client via Messenger.

**Manual Response** – Sales staff responds directly through Facebook Messenger application; the system does not provide conversation viewing or reply functionality.

#### Customer Record Module
Stores and manages confirmed customer details from booking inquiries.

- **Customer Record Generation** – Customer records are created when Sales presses "Record Customer Details" button on a specific booking inquiry notification in the Inquiry Management Module. This action generates a customer record containing the customer details that were collected during the chatbot messenger conversation.
- **Trigger Condition** – Customer record is generated in Inquiry Management Module once booking is confirmed through manual human discussion between Sales and the client via Messenger.
- **Stored Information** – Full name, contact number, plate number, vehicle unit, and associated Page-Scoped ID (PSID) from Messenger.
- **Purpose for Operations** – Enables autofill functionality of customer details when creating job orders in the Job Management Module.
- **Purpose for Chatbot Integration** – Connects the customer's PSID with their plate number and contact details, allowing the chatbot to provide automatic vehicle status updates to the correct customer.
- **Search and Filter** – Search by customer name, plate number, contact number, or email.
- **Edit Customer Record** – Update customer details (except PSID) or vehicle information.
- **View Customer Record** – Display full customer information and associated booking history.

---

### Internal Staff Side – Web Mobile Interface (Head Detailer and Head Installer)

Both Head Detailer and Head Installer share an identical modular structure with role-based data filtering, accessed via a mobile-optimized navigation system.

**Login Page** – Head Detailers and Head Installers log in using credentials created by the Admin.

---

### Head Detailer

The Head Detailer holds supervisory authority over the preparation phase of all assigned jobs and is responsible for approving preparation completion before handoff to the installation team.

#### Dashboard
Real-time overview of assigned preparation jobs.

- **Active Jobs Overview** – Displays all jobs with assigned detailer team in card-based layout.
- **Job Card View** – Customer name, vehicle information, service type, scheduled date, current status, progress indicator.
- **Filter and Sort** – Filter by status or date for easier monitoring.
- **Card Navigation** – Clicking a job order card navigates to the Service Stage Progression Module for that specific job.

#### Service Stage Progression Module
Primary working function for preparation stages.

- **Stage Checklist View** – Displays all preparation stages for the assigned service in sequence.
- **Photo and Video Upload per Stage** – Required documentation for each installation stage. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- **Mark Stage as Done** – Completes current stage with automatic timestamp.
  - **Automated Vehicle Status Updates** - Status and photo/video is sent by Gemini chatbot to client on Messenger.
- **Approve Preparation Completion** – Marks all preparation stages complete with optional handoff notes for Head Installer.
- **Flag Preparation for Rework** – Select specific preparation stages requiring rework, provide written rework notes, revert selected preparation stages to "In Progress."
- **Scope Limitation** – Can only flag preparation stages.

#### Concern Submission Module
Report job-related issues to Operations.

- **Access via Bottom Navigation** – Concern submission accessible through dedicated bottom navigation tab.
- **Manual Entry** – Head Detailer manually enters concern title and description text fields.
- **Concern Title** – Required text field for brief concern summary.
- **Concern Description** – Required text field for detailed explanation.
- **Optional Photo/Video Attachment** – Head Detailer can optionally attach photos or videos to the concern. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- **Submit to Operations** – Sends concern to Operations dashboard with automatic notification.
- **View Submitted Concerns** – Read-only view of own submitted concerns with status (Pending/Resolved) and Operations response notes.

---

### Head Installer

The Head Installer holds supervisory authority over the installation phase of all assigned jobs and is responsible for conducting the final quality check before vehicle release.

#### Dashboard
Real-time overview of assigned installation jobs.

- **Active Jobs Overview** – Displays all jobs with assigned installer team in card-based layout.
- **Job Card View** – Customer name, vehicle information, service type, scheduled date, current status, progress indicator.
- **Filter and Sort** – Filter by status or date for easier monitoring.
- **Handoff Notifications** – Visual indicator for newly received jobs from Head Detailer.
- **Card Navigation** – Clicking a job order card navigates to the Service Stage Progression Module for that specific job.

#### Service Stage Progression Module
Primary working function for installation stages.

- **View Preparation Handoff Notes** – Read-only summary of handoff notes from Head Detailer when beginning installation work.
- **Stage Checklist View** – Displays all installation stages for the assigned service in sequence.
- **Photo and Video Upload per Stage** – Required documentation for each installation stage. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- **Mark Stage as Done** – Completes current stage with automatic timestamp.
  - **Automated Vehicle Status Updates** - Status and photo/video is sent by Gemini chatbot to client on Messenger.
- **Final Quality Check and Approval** – When the last installation stage is completed, approve the job as Completed or flag for rework.
- **Flag Installation for Rework** – Select specific installation stages requiring rework, provide written rework notes, revert selected installation stages to "In Progress."
- **Scope Limitation** – Can only flag installation stages.

#### Concern Submission Module
Report job-related issues to Operations.

- **Access via Bottom Navigation** – Concern submission accessible through dedicated bottom navigation tab.
- **Manual Entry** – Head Installer manually enters concern title and description text fields.
- **Concern Title** – Required text field for brief concern summary.
- **Concern Description** – Required text field for detailed explanation.
- **Optional Photo/Video Attachment** – Head Installer can optionally attach photos or videos to the concern. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- **Submit to Operations** – Sends concern to Operations dashboard with automatic notification.
- **View Submitted Concerns** – Read-only view of own submitted concerns with status (Pending/Resolved) and Operations response notes.

---

### Messenger AI Chatbot Integration

The system integrates with the company's official Facebook Page via the Meta Messenger Platform API, enabling automated customer interaction through an AI chatbot powered by Gemini.

#### AI Chatbot (Gemini API)

- **Scope of AI Responses** – The AI is configured to respond to company-related inquiries such as services and pricing, business hours and location, general detailing FAQs, and vehicle status updates.
- **Default Quick Reply Options** – Upon opening the chatbot, customers are presented with predefined quick reply buttons for the most common inquiry categories. (e.g., Services and Prices, Booking, Report Concern)
- **Customer Detail Collection for Booking** – When customers express booking intent, the chatbot collects and records required customer information including full name, contact number, plate number, and vehicle unit. These details are temporarily stored and associated with the customer's Page-Scoped ID (PSID) until the booking is confirmed.
- **Automated Vehicle Status Updates** – The AI chatbot automatically provides status updates each stage progression and returns the current documentation and status in real-time.
- **Escalation Triggers** – The conversation is automatically flagged for human assistance when the AI cannot provide a relevant answer, when manual intervention is requested, when booking details are collected, or when verification fails.
- **Human Handover** – Once escalated, Sales opens the full chat thread including all prior AI responses and replies directly through Messenger. The conversation status updates upon Sales response.

---

## Limitations of the Project

### No Automated Booking and Appointment Scheduling
The system does not process, confirm, or finalize bookings. Booking inquiries through the Messenger chatbot are escalated to Sales for manual coordination and job order creation.

### Chatbot Functionality and AI Response Accuracy
The Messenger AI chatbot's response accuracy depends on the completeness and quality of its system prompt configuration and knowledge base. Incomplete or outdated information may result in inaccurate responses. The chatbot accesses only job status information and cannot retrieve other internal operational data.

### Messenger-Based Communication Restrictions
Automatic vehicle status updates are limited to the specific Messenger account used during initial contact, operating on a strict one-to-one account basis.

### Messenger Account Security
The system relies on Facebook Messenger, which is governed by Meta's platform security policies. The system cannot prevent or mitigate customer-side security incidents including account hacking, unauthorized access, device theft, or loss of communication capability.

### No Online Payment Processing and Sales-Related Features
The system does not support online payment transactions. Payment details are recorded manually by Sales outside the system. Sales-related features such as revenue tracking, sales reporting, and financial summaries are not included.

### Limited to Active Service Lifecycle Processes
The system manages operations only from job order creation to vehicle release. Pre-service processes such as contract signing and initial vehicle inspection, as well as post-service processes such as refund processing, warranty claims, and after-service follow-ups are excluded.

### No Documentation Quality Validation and Individual Performance Tracking
The system accepts uploaded photos and videos based solely on file format and size requirements without content validation. Job assignments and completions are tracked at the team level only, excluding individual technician performance metrics, productivity data, and work quality assessments.

---

**Document Version:** Ver 6.2  
**Institution:** STI College Ortigas-Cainta  
**Project:** 826 Auto Care OPC Service Management System
