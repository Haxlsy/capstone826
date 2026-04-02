# UPDATED SCOPE AND REQUIREMENTS DOCUMENTATION (v3)
## A Web-Based Vehicle Service Management System with Messenger-Integrated Chatbot for 826 Auto Care OPC
### Compiled with all revisions as of April 2026

---

# PART 1: SCOPE OF THE PROJECT

## Scope and Limitations

The system designed and developed by the proponents aims to enhance and optimize the internal service management and external customer communication operations of 826 Auto Care OPC. The system addresses the critical challenges encountered by the company, including undocumented service workflows, disruptive manual status inquiries on the shop floor, the absence of centralized and retrievable operational records, and an overwhelmed digital communication channel. By implementing this system, 826 Auto Care's administrative staff, Head Technicians, and Technicians will be equipped with a centralized, role-based platform to manage vehicle service job orders from intake to final release, maintain organized and retrievable records of clients, vehicles, and job order histories, generate comprehensive operational reports on job orders and technician performance to support informed decision-making, while customers benefit from human-assisted vehicle service status updates and automated support through Facebook Messenger. The system is intended for use by the management and staff of 826 Auto Care OPC, scoped specifically for the main branch in Cainta, Rizal.

---

## Internal Staff Side – Web Page (Admin, Operations, Sales)

**Login Page** – Role-based secure login for Admin, Operations, and Sales users. One initial Admin account is provided by the system developers; Operations and Sales accounts are created by the Admin.

---

### Admin Role Modules

**Account Management Module (Manage User Accounts)** – Accessible exclusively to Admin; enables creation, editing, and archiving of Operations and Sales staff accounts, as well as Head Technician and Technician accounts. Only the Admin may create, modify, or archive any internal user account.

- Add User Account – Create login credentials and a profile for a new staff member (Operations, Sales) or technician (Head Technician, Technician).
- Edit User Account – Modify user details such as name, contact number, and credentials.
- Archive User Account – Deactivate a former employee's account while preserving their records for historical reference.

**Service Management Module (Manage Service Catalog)** – Accessible exclusively to Admin; enables creation, editing, and archiving of services, each configured with a name, description, price, estimated service duration (in days), and defined workflow stages.

- Add Service – Create a new service entry with its name, description, price, estimated service duration (in days), and defined workflow stages (e.g., for PPF installation: Surface Preparation, Film Cutting, Film Application, Edge Sealing, Final Inspection).
- Edit Service – Update existing service details, pricing, estimated duration, and workflow stages.
- Archive Service – Remove a service from the active list without permanent deletion.

**Report Generation Module (Generate Reports)** – Accessible exclusively to Admin; generates Job Order Reports, Customer Reports, and a Technician Performance Log, all filterable by date range, service type, status, and technician, and exportable in PDF and Excel formats.

- Job Order Reports – Generates a summary report of all job orders within a specified period. Supports filtering by date range, service type, job status, or assigned technician, and export in PDF and Excel formats.
- Customer Reports – Generates a summary report of all customer records and their associated service histories. Supports filtering by name, date, or service history, and export in PDF and Excel formats.
- Technician Performance Log – Records all jobs handled by each technician for accountability and performance monitoring. Includes an Admin Dashboard View displaying a performance summary per technician (total jobs completed, jobs in progress, flagged concerns) and a Reports and Audit Section showing detailed work history (technician name, car details, services performed, time started and completed, full status history with timestamps). Supports filtering by technician name, date range, or job status, and export in PDF and Excel formats.

---

### Operations Role Modules

**Dashboard / Operations Center** – Accessible to Operations; provides a real-time overview of job status through a Pending Intake Indicator, summary cards, and a Job Calendar View.

- Pending Intake Indicator – Displays the count of customer intake records submitted by Sales that have not yet been converted into job orders, alerting Operations to confirmed bookings awaiting job order creation.
- Summary Cards – Displays job counts categorized by status: Pending, Ongoing, Quality Check, Completed, Delayed, and Released.
- Job Calendar View – Shows all scheduled jobs in a calendar format for visibility and planning.
- Quick Access – Provides shortcuts to pending intake records, recent job orders, and flagged concerns.

**Job Management Module** – Accessible to Operations; enables creation, editing, assignment, and status updating of job orders across all seven stages: Pending, Ongoing, Quality Check, Completed, Delayed, Cancelled, and Released.

- Add Job Order – Create a new job order based on a customer intake record submitted by Sales. Operations verifies the information and completes the job order by assigning a technician and setting the scheduled date and time. The job timeline (start date and expected completion date) is automatically generated by the system based on the service type's estimated duration and the date the job order is created. Job orders are created only after pre-service processes such as contract signing and visual condition checking have been completed outside the system, confirming the vehicle for service.
- Edit Job Order – Modify job order details such as assigned technician or scheduled date and time. Operations cannot modify customer details, vehicle information, payment details, or the system-generated job timeline; any corrections to customer data must be coordinated with Sales.
- Assign Technician – Assign or reassign a technician to a specific job order.
- Change Job Status – Manually update a job order's status across the following stages: Pending (awaiting technician action), Ongoing (work in progress), Quality Check (undergoing Head Technician inspection), Completed (approved and ready for pickup), Cancelled (cancelled under exceptional circumstances), Delayed (prolonged due to issues), and Released (vehicle retrieved by the owner).

**View Customer Intake Records** – Accessible to Operations; provides read-only access to all customer intake records submitted by Sales, including customer details, vehicle information, intended service type, payment details, and scheduled booking date. These records serve as the reference for job order creation. Operations cannot add, edit, or archive intake records; any corrections must be coordinated with Sales.

- Resolve Intake Record – Operations can update the status of a pending intake record to either "Job Created" (automatically set when a job order is created from it) or "Cancelled" (when the customer does not proceed after pre-service processes). When marking as Cancelled, Operations is required to provide a cancellation reason. Operations cannot edit any customer, vehicle, or payment data within the intake record.

**Concern and Escalation Management Module (Receive Job Concerns)** – Accessible to Operations; displays all technician-submitted concerns with job reference, concern type, description, and attachments. Operations may resolve concerns and add response notes.

- Notifications Bell – Displays a badge count on the dashboard whenever a technician submits a new concern.
- Concerns Inbox – Lists all reported concerns with the job order reference, technician name, concern type, description, photo attachments if provided, and submission timestamp.
- Resolve Concern – Allows Operations to mark a concern as Resolved and optionally add a response note to the technician.

**Record Management: Job Order Records** – Accessible to Operations; provides a structured view of all job orders processed by the branch.

- View Job History – Displays a complete log of all status changes, service stage updates, assigned technicians, service types, and photo and video documentation uploaded throughout the job, with timestamps.
- Filter and Search – Filter job order records by date range, service type, status, or assigned technician for easier retrieval.
- Export – Job order records and history can be exported in PDF and Excel formats.

---

### Sales Role Modules

**Sales Dashboard** – Accessible to Sales; provides a notification-centric view for customer communication tasks.

- Messenger Inbox Notification – Displays a notification badge when a customer message requires human attention.
- Vehicle Status Inquiry Alert – Flags any active Messenger conversation where a customer is waiting for a manual vehicle or job order status response.
- Delay Notification Alert – Flags any job marked as Delayed by Operations where the customer has not yet been notified, prompting Sales to send the delay notification.

**Messenger Inbox Module (Handle Messenger Inquiry, Notify Status via Messenger)** – Accessible to Sales; enables handling of customer conversations escalated from the AI chatbot, responding to vehicle or job order status inquiries, and sending customer notifications.

- Send Customer Notification – Upon Head Technician approval and Operations marking the job as Completed, Sales sends the customer a pickup notification through the Messenger Inbox using a pre-populated message template. For jobs marked as Delayed by Operations, Sales notifies the customer of the delay reason through Messenger.

**Message Template Management** – Accessible to Sales; enables creation and customization of notification templates using dynamic placeholders: [Customer Name], [Sales Staff Name], [Plate Number], [Car Model], and [Service Type].

**Customer Intake (Gather Details via Chat, Input Customer Records)** – Accessible to Sales; upon a confirmed booking through Messenger, Sales gathers and inputs the following into the system: customer details (name, contact number, email address, home address), vehicle information (plate number, make, model, color), intended service type, payment details (downpayment amount, remaining balance, and payment method), and scheduled booking date. This intake record serves as the basis for job order creation by Operations once the vehicle is confirmed for service.

- Reschedule Booking – Sales can update the scheduled booking date on a pending intake record when a customer requests a reschedule through Messenger. The previous date and reason for rescheduling are logged for record-keeping.
- View Intake Status – Sales can view the current status of all submitted intake records, including those marked as Cancelled by Operations along with the cancellation reason, for customer follow-up if needed.

**Record Management: Customer Records** – Accessible to Sales; provides full management of all registered customer profiles tied to job orders within the system.

- Add Customer – Input customer details including name, contact number, email address, and home address.
- Edit Customer – Modify existing customer information as needed.
- Archive Customer – Preserve customer records without permanent deletion to maintain data integrity.
- View Customer Job History – Access the complete service history of a specific customer, including all past and active job orders associated with their profile.
- Export – Customer records can be exported in PDF and Excel formats.

**View Job Order Status (Read-Only)** – Accessible to Sales; provides read-only access to job order records for the purpose of responding to customer vehicle status inquiries. Sales can search by customer name, plate number, or job order ID and view the current job status, service stage progression, assigned technician, scheduled timeline, and expected completion date. Sales cannot create, edit, or change the status of any job order.

**Record Management: Vehicle Records** – Vehicle information is captured and stored per job order, including plate number, make, model, and color, and is accessible through the associated customer profile and job order history. Accessible to both Operations (read-only) and Sales (full management).

---

### Head Technician Side – Web Page (Mobile Interface)

The Head Technician holds supervisory access over all active job orders and is responsible for conducting the final quality check before any vehicle is cleared for customer pickup.

**Login Page**
- Head Technicians log in using credentials created by the Admin.
- Access is restricted to Head Technician-specific features only.

**Active Jobs Overview** – Displays all Ongoing and Quality Check stage job orders across the shop floor.

- Job Card View – Each job is displayed as a card showing customer name, vehicle information, service type, assigned technician, scheduled date and time, and current status with a progress indicator.
- Filter and Sort – Filter jobs by status or technician for easier monitoring.

**Quality Check and Approval** – The primary supervisory function of the Head Technician. When a technician marks a job as Quality Check, the Head Technician reviews the completed work and stage-by-stage documentation before making a final determination.

- Photo and Video Documentation Upload – The Head Technician can upload photos and videos from their mobile device as the official final documentation of the completed work, complementing the stage-level documentation submitted by the technician. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).
- Approve Job – Marks the job as Completed and prompts Sales to send the customer a pickup notification through Messenger.
- Flag for Rework – Returns the job to the assigned technician with written rework instructions sent through the system.

**View Job History** – Displays the full status history, service stage progression, and all photo and video documentation uploaded by both the technician and the Head Technician for any active job order.

**Technician Concern Visibility** – The Head Technician can view concerns submitted by technicians for situational awareness. Concern resolution remains the responsibility of Operations.

---

### Technician Side – Web Page (Mobile Interface)

**Login Page**
- Technicians log in using credentials created by the Admin.
- Access is limited to technician-specific features only.

**My Jobs Dashboard** – Displays all job orders assigned to the logged-in technician in a card-based layout.

- Job Card View – Each job is displayed as a card showing customer name, vehicle information (plate number, make, model, and color), service type, scheduled date and time, and current status with a progress indicator.
- Filter and Sort – Filter the job list by date or status for easier navigation.

**Job Status Update** – Technicians can advance a job through three stages: Pending (not yet started), Ongoing (in progress), and Quality Check (awaiting Head Technician inspection). Each update is automatically timestamped and logged. Technicians cannot edit job details or mark a job as Completed.

**Service Stage Progression and Documentation** – The primary working function of the technician interface. Each job contains service-specific workflow stages defined by the Admin. Technicians progress through each stage sequentially, and each stage must be documented before advancing to the next.

- Stage Checklist View – Displays all stages for the assigned service in sequence, with the current stage clearly indicated.
- Mark Stage as Done – Marks the current stage as completed, automatically timestamped and logged.
- Photo and Video Upload per Stage – Technicians are required to upload photos and/or videos at each stage as documentation of the work performed. Supported formats: JPG, JPEG, PNG (max 5MB per photo); MP4, MOV (max 50MB per video).

**Report / Flag a Concern** – Allows technicians to escalate job-related issues directly to Operations.

- Report Button – Opens a concern submission form with a Concern Type dropdown, a Description field, and an optional Photo Attachment (JPG, JPEG, PNG; max 5MB).
- Submit Button – Sends the concern to Operations and triggers a dashboard notification. A confirmation message is displayed to the technician upon successful submission.

---

### Messenger AI Chatbot Integration

The system integrates with the company's official Facebook Page via the Meta Messenger Platform API, enabling automated customer interaction through an AI-powered chatbot. The chatbot is strictly limited to general company-related information and has no access to private job order data.

**AI Chatbot (Gemini API)**

- Scope of AI Responses – The AI is configured via a system prompt to respond only to company-related inquiries such as services and pricing, business hours and location, and general detailing FAQs.
- Default Quick Reply Options – Upon opening the chatbot, customers are presented with predefined quick reply buttons for the most common inquiry categories: Services and Pricing, Business Hours and Location, and How to Book. Customers may also type freely at any point, and out-of-scope inquiries automatically trigger escalation.
- Escalation Triggers – The conversation is automatically flagged as Awaiting Human Reply when: the AI cannot provide a relevant answer, the customer asks about a specific vehicle or job order, the customer requests a human agent, or no human response has been given within a set time threshold.
- Vehicle Status Inquiry Detection – When the AI detects a vehicle or job order status inquiry, the conversation is immediately flagged as a Vehicle Status Inquiry in the Messenger Inbox Module, triggering a distinct visual indicator on the Sales Dashboard. The chatbot acknowledges the inquiry and informs the customer that a staff member will respond shortly.
- Human Handover – Once escalated, Sales opens the full chat thread — including all prior AI responses — and replies directly through Messenger. The conversation status updates to Replied upon Sales response.

---

### Limitations of the Project

- **No Automated Booking and Appointment Scheduling** – The system does not include an automated booking or appointment scheduling feature. While customers may express their intent to book a service through the Messenger chatbot, the chatbot itself does not process, confirm, or finalize any booking. Inquiries or requests regarding booking made through the chatbot will be escalated to Sales, who will then coordinate directly with the customer to confirm the details and manually create the corresponding intake record within the system.

- **Chatbot Functionality and AI Response Accuracy** – The Messenger AI chatbot is strictly limited to general company-related inquiries and cannot access any private customer or job order data. Vehicle status inquiries are acknowledged by the chatbot and escalated to Sales, who manually checks the system and responds through the Messenger Inbox Module. Additionally, the accuracy of the chatbot's responses is dependent on the completeness and quality of its system prompt configuration — incomplete or outdated information may result in inaccurate or unhelpful responses.

- **Messenger Account Security** — The system's customer-facing communication operates entirely through Facebook Messenger, which is subject to Meta's own platform security policies and is outside the direct control of the proposed system.

- **Limited to Active Service Lifecycle Processes** – The system is designed to manage vehicle service operations strictly within the active service period, beginning from job order creation and ending upon the release of the vehicle to the customer. Pre-service processes such as contract signing, initial vehicle inspection, and visual condition checking prior to service commencement are not facilitated within the system. Similarly, post-service processes such as refund processing, warranty claims, or after-service follow-ups are outside the scope of the system.

- **No Online Payment Processing and Sales-Related Features** – The system does not support online payment transactions. Payment details such as downpayment amounts and remaining balances are recorded and tracked manually by Sales within the system. Furthermore, the system does not include any sales-related features such as revenue tracking, sales reporting, or financial summaries.

- **No Availability Management** – The system does not manage or display technician schedules, shop capacity, or available booking slots. Sales determines booking dates based on availability information managed outside the system. The system records the scheduled booking date as provided by Sales but does not validate it against existing bookings.

---
---

# PART 2: REQUIREMENTS DOCUMENTATION

## 1. User Types and Roles

**Admin:**
- Has full administrative access; manages all internal user accounts and the service catalog.
- Can create, edit, and archive all user accounts: Operations, Sales, Head Technician, and Technician.
- Can add, edit, and archive service entries, each configurable with a name, description, price, estimated service duration (in days), and defined workflow stages.
- Can generate and export job order, customer, and technician performance reports in PDF and Excel formats.

**Operations:**
- Can create job orders based on customer intake records submitted by Sales by assigning a technician and setting the scheduled date and time. The job timeline is automatically generated by the system.
- Can edit job order details limited to operational fields: assigned technician and scheduled date and time. Cannot modify customer details, vehicle information, payment details, or the system-generated job timeline.
- Can manually update job statuses across all seven stages: Pending, Ongoing, Quality Check, Completed, Delayed, Cancelled, and Released.
- Has read-only access to customer intake records submitted by Sales, including scheduled booking date, for reference during job order creation.
- Can mark a pending intake record as Cancelled with a required cancellation reason when a customer does not proceed.
- Can view and resolve technician-submitted concerns.

**Sales:**
- Can gather and input customer intake records upon confirmed booking through Messenger, including customer details, vehicle information, intended service type, payment details (downpayment amount, remaining balance, and payment method), and scheduled booking date.
- Can reschedule the booking date on a pending intake record when a customer requests a reschedule, with the previous date and reason logged.
- Can view the current status of all submitted intake records, including those marked as Cancelled by Operations along with the cancellation reason.
- Has full management of customer records: add, edit, archive, view job history, and export.
- Has full management of vehicle records linked per job order to the corresponding customer profile.
- Can manage Messenger conversations through the Messenger Inbox Module, including handling escalated inquiries, responding to vehicle or job order status inquiries, and sending customer notifications.
- Can create and customize message templates through the Message Template Management module.
- Has read-only access to job order statuses, including current status, service stage progression, assigned technician, and job timeline, for responding to customer vehicle status inquiries through Messenger.

**Head Technician:**
- Access restricted to Head Technician features; credentials created by the Admin.
- Can view all active Ongoing and Quality Check job orders across the shop floor.
- Can conduct quality checks by reviewing stage documentation and uploaded media, then either approve a job or flag it for rework with written instructions.
- Can upload photos and videos as final documentation prior to job approval.
- Can view technician-submitted concerns for situational awareness only; resolution is handled by Operations.

**Technician:**
- Access restricted to Technician features; credentials created by the Admin.
- Can view assigned job orders and update job status through three stages: Pending, Ongoing, and Quality Check.
- Can progress through service-specific workflow stages sequentially, marking each as done and uploading required photo or video documentation per stage.
- Can submit job-related concerns to Operations, including concern type, description, and an optional photo attachment.

**Customers (via Facebook Messenger):**
- Interact with the system indirectly through the company's Facebook Messenger page.
- Receive automated AI responses to general inquiries about services, pricing, business hours, and booking guidance.
- Receive human-assisted responses for vehicle or job order status inquiries, which are escalated to Sales.
- Have no direct access to the web-based system or internal job order data.

---

## 2. Core System Features

**Job Order Management Module:**
- Enables Operations to create job orders based on customer intake records submitted by Sales, completing the job order by assigning a technician and setting the scheduled date and time.
- The system automatically generates the job timeline (start date and expected completion date) based on the service type's estimated duration and the date the job order is created.
- Operations can edit operational fields (technician assignment, scheduled date and time) but cannot modify customer details, vehicle information, payment details, or the system-generated job timeline.
- Tracks all seven job status stages with automatic timestamps; all changes are logged.
- Operations Dashboard displays a Pending Intake Indicator for confirmed bookings awaiting job order creation, summary cards by status, and a Job Calendar View.

**Customer Intake Module:**
- Enables Sales to input customer details (name, contact number, email address, home address), vehicle information (plate number, make, model, color), intended service type, payment details (downpayment amount, remaining balance, and payment method), and scheduled booking date upon a confirmed booking through Messenger.
- Intake records are visible to Operations as read-only and serve as the basis for job order creation once the vehicle is confirmed for service.
- Sales can update the scheduled booking date on a pending intake record when a customer reschedules; the previous date and reason are logged.
- Operations can mark a pending intake record as Cancelled with a required cancellation reason when a customer does not proceed. Operations cannot modify any other intake record data.
- Cancellation status and reason are visible to Sales for customer follow-up.
- Intake record statuses are: Pending Job Order, Job Created, and Cancelled.

**Service Stage Documentation:**
- Each job contains service-specific workflow stages defined by the Admin; Technicians progress through stages sequentially.
- Each stage requires photo or video documentation before advancement; the Head Technician uploads final documentation before approval.

**Records Management Module:**
- Customer Records — Managed by Sales; provides full management (add, edit, archive, view job history, export) of all registered customer profiles tied to job orders within the system.
- Vehicle Records — Managed by Sales; vehicle information is captured and stored per job order, including plate number, make, model, and color, and is accessible through the associated customer profile and job order history. Operations has read-only access.
- Job Order Records — Managed by Operations; provides a structured view of all job orders processed by the branch, including full history log, filter and search by date range, service type, status, or assigned technician, and export in PDF and Excel formats.

**Report Generation Module:**
- Generates job order summary reports, customer reports, and a Technician Performance Log.
- All reports are filterable by date, service, status, and technician, and exportable in PDF and Excel formats.
- Accessible exclusively to Admin.

**Service Management Module:**
- Enables Admin to add, edit, and archive services, each configurable with a name, description, price, estimated service duration (in days), and defined workflow stages.

**Account Management Module:**
- Enables Admin to create, edit, and archive all internal user accounts: Operations, Sales, Head Technician, and Technician, while preserving historical records of archived accounts.

**Job Concern and Escalation Management:**
- Provides a Concerns Inbox for Operations showing all technician-submitted concerns with job reference, concern type, description, attachments, and timestamps.
- Operations can resolve concerns and add response notes; a notification badge appears for each new submission.

**Message Template Management:**
- Enables Sales to manage predefined notification templates with dynamic placeholders: [Customer Name], [Sales Staff Name], [Plate Number], [Car Model], and [Service Type].

**Messenger-Integrated AI Chatbot Module:**
- Integrates with the company's official Facebook Page via the Meta Messenger Platform API, powered by the Gemini API.
- Responds to general inquiries about services, pricing, hours, and booking; presents quick reply buttons for common inquiry categories.
- Automatically escalates conversations to Sales and flags them as Awaiting Human Reply when the inquiry is beyond scope, job-specific, or a human agent is requested.
- Detects vehicle or job order status inquiries and immediately flags the conversation with a Vehicle Status Inquiry indicator on the Sales Dashboard; the chatbot has no access to internal job order data.

**Messenger Inbox Module:**
- Displays all customer Messenger conversations within the Sales Dashboard with status, message preview, and time elapsed.
- Tags vehicle status inquiry conversations with a distinct visual indicator for Sales prioritization.
- Allows Sales to view the full conversation thread and reply directly through Messenger; status updates to Replied upon response.
- Upon Head Technician approval and Operations marking the job as Completed, Sales sends the customer a pickup notification through a pre-populated message template. For jobs marked as Delayed by Operations, Sales notifies the customer of the delay reason through Messenger.

**Job Order Status Visibility (Sales):**
- Provides Sales with read-only access to job order statuses for responding to customer vehicle status inquiries. Sales can search by customer name, plate number, or job order ID and view current status, service stage progression, assigned technician, scheduled timeline, and expected completion date. Sales cannot create, edit, or change the status of any job order.

---

## 3. System Design and User Interface

The system interfaces are organized by user roles. The Admin, Operations, and Sales sides are accessible via desktop browser; the Head Technician and Technician sides are mobile-friendly web interfaces.

**Admin Side — Web Page:**
- Login Page — Secure login; one initial admin account provided by the system developers.
- Account Management — Create, edit, and archive all internal user accounts (Operations, Sales, Head Technician, Technician).
- Service Management — Add, edit, and archive services with their estimated duration and workflow stages.
- Report Generation Module — Job Order Reports, Customer Reports, and Technician Performance Log; all filterable and exportable in PDF and Excel.

**Operations Side — Web Page:**
- Login Page — Secure login; accounts created by the Admin.
- Dashboard / Operations Center — Real-time overview with Pending Intake Indicator, job status summary cards, and Job Calendar View.
- View Customer Intake Records — Read-only access to all customer intake records submitted by Sales, including scheduled booking date. Resolve intake records as Job Created or Cancelled with reason.
- Job Management — Create job orders from Sales-submitted intake records, assign technicians, set scheduled date and time, and update job statuses. Job timeline is auto-generated by the system.
- Job Concern and Escalation Management — Concerns Inbox with notification badge; resolve concerns with optional response notes.
- Record Management: Job Order Records — Full job order history log with filter, search, and export in PDF and Excel formats.

**Sales Side — Web Page:**
- Login Page — Secure login; accounts created by the Admin.
- Sales Dashboard — Notification-centric view with Messenger Inbox Notification badge, Vehicle Status Inquiry Alert, and Delay Notification Alert.
- Messenger Inbox Module — Full conversation list with status indicators; vehicle status inquiry tagging; Sales reply and status update functionality; send customer pickup and delay notifications.
- Message Template Management — Add and customize notification templates with dynamic placeholders.
- Customer Intake — Input customer details, vehicle information, intended service type, payment details, and scheduled booking date upon confirmed booking. Reschedule booking dates with logged reason.
- Record Management: Customer Records — Add, edit, archive, view job history, and export customer profiles.
- View Job Order Status — Read-only access to job order statuses, searchable by customer name, plate number, or job order ID, for responding to customer vehicle status inquiries.
- Record Management: Vehicle Records — Per job order, linked to customer profile; full management by Sales.

**Head Technician Side — Web Page (Mobile Interface):**
- Login Page — Role-restricted login using Admin-created credentials.
- Active Jobs Overview — Card-based view of all Ongoing and Quality Check job orders; filterable by status and technician.
- Quality Check and Approval — Review stage documentation and media; upload final photos/videos; Approve or Flag for Rework with written instructions.
- View Job History — Full status history, stage progression, and documentation for any active job order.
- Technician Concern Visibility — View-only access to submitted technician concerns.

**Technician Side — Web Page (Mobile Interface):**
- Login Page — Role-restricted login using Admin-created credentials.
- My Jobs Dashboard — Card-based view of all assigned jobs; filterable by date and status.
- Job Status Update — Advance job through Pending, Ongoing, and Quality Check; each update is timestamped and logged.
- Service Stage Progression and Documentation — Sequential stage checklist; each stage requires marking as done and uploading photo or video documentation.
- Report / Flag a Concern — Submit concern with type, description, and optional photo; triggers Operations notification upon submission.

---

## 4. Functional Requirements

### Authentication and Access Control

- **REQ001.** The system shall provide one predefined Admin account created by the system developers for first-time access.
- **REQ002.** The system shall authenticate Admin, Operations, Sales, Head Technician, and Technician users via username and password.
- **REQ003.** The system shall restrict each user to features and data relevant to their assigned role only.
- **REQ004.** Customers shall have no access to the web-based system or any of its administrative functionalities.

### Account and Service Management

- **REQ005.** The system shall allow the Admin to create, edit, and archive all internal user accounts: Operations, Sales, Head Technician, and Technician, while preserving historical records of archived accounts.
- **REQ006.** The system shall allow the Admin to add, edit, and archive services, each configured with a name, description, price, estimated service duration (in days), and defined workflow stages.
- **REQ007.** The system shall use the estimated service duration defined per service type, in combination with the job order creation date, to automatically generate the job timeline (start date and expected completion date).

### Customer Intake

- **REQ008.** The system shall allow Sales to input customer intake records upon a confirmed booking, capturing customer details (name, contact number, email address, home address), vehicle information (plate number, make, model, color), intended service type, payment details (downpayment amount, remaining balance, and payment method), and scheduled booking date.
- **REQ009.** The system shall make all customer intake records submitted by Sales visible to Operations as read-only for reference during job order creation, including customer details, vehicle information, intended service type, payment details, and scheduled booking date.
- **REQ010.** The system shall display a Pending Intake Indicator on the Operations Dashboard showing the count of customer intake records submitted by Sales that have not yet been converted into job orders.
- **REQ011.** The system shall allow Operations to mark a pending customer intake record as Cancelled with a required cancellation reason when the customer does not proceed after pre-service processes. Operations cannot modify any other intake record data.
- **REQ012.** The system shall make the cancellation status and reason of intake records visible to Sales for customer follow-up purposes.
- **REQ013.** The system shall allow Sales to update the scheduled booking date on a pending intake record and require a reason for rescheduling. The system shall log the previous date and the rescheduling reason.

### Job Order Management

- **REQ014.** The system shall allow Operations to create job orders based on customer intake records submitted by Sales, completing the job order by assigning a technician and setting the scheduled date and time. The job timeline shall be automatically generated by the system based on the service type's estimated duration and the job order creation date.
- **REQ015.** The system shall allow Operations to edit operational job order fields (assigned technician, scheduled date and time), reassign technicians, and update job statuses. Operations cannot modify customer details, vehicle information, payment details, or the system-generated job timeline.
- **REQ016.** The system shall log all status transitions across seven stages — Pending, Ongoing, Quality Check, Completed, Delayed, Cancelled, and Released — each with an automatic timestamp.
- **REQ017.** The system shall allow Technicians to advance job status through Pending, Ongoing, and Quality Check.
- **REQ018.** The system shall allow the Head Technician to approve a completed job or flag it for rework with written instructions sent to the assigned Technician.

### Service Stage Progression and Documentation

- **REQ019.** The system shall present service-specific workflow stages to the Technician in sequential order.
- **REQ020.** The system shall require photo or video documentation at each stage before the Technician may advance.
- **REQ021.** The system shall allow the Head Technician to upload final photo or video documentation prior to job approval.
- **REQ022.** The system shall support JPG, JPEG, PNG (max 5 MB per file) and MP4, MOV (max 50 MB per file) for all uploads.

### Records Management

- **REQ023.** The system shall allow Sales to add, edit, and archive customer profiles including name, contact number, email address, and home address.
- **REQ024.** The system shall store vehicle information — plate number, make, model, and color — per job order, linked to the corresponding customer profile. Vehicle records shall be managed by Sales; Operations shall have read-only access.
- **REQ025.** The system shall provide a complete job order history log of all status changes, stage updates, technician assignments, and uploaded documentation with timestamps.
- **REQ026.** The system shall support filter and search of records by date range, service type, status, and assigned technician.
- **REQ027.** The system shall allow Sales to export customer records and Operations to export job order records in PDF and Excel formats.

### Report Generation

- **REQ028.** The system shall generate job order summary reports and customer reports, filterable by date range, service type, status, and technician. Accessible exclusively to Admin.
- **REQ029.** The system shall generate a Technician Performance Log recording all jobs handled per technician with service details, timestamps, and full status history. Accessible exclusively to Admin.
- **REQ030.** The system shall allow all reports to be exported in PDF and Excel formats. Accessible exclusively to Admin.

### Job Concern and Escalation Management

- **REQ031.** The system shall allow Technicians to submit concerns to Operations with a concern type, description, and optional photo attachment.
- **REQ032.** The system shall display a notification badge on the Operations Dashboard upon each new concern submission.
- **REQ033.** The system shall allow Operations to mark concerns as Resolved and add an optional response note.
- **REQ034.** The system shall allow the Head Technician to view technician-submitted concerns for situational awareness only. Concern resolution shall remain the responsibility of Operations.

### Messenger-Integrated AI Chatbot

- **REQ035.** The system shall integrate with the company's official Facebook Page via the Meta Messenger Platform API.
- **REQ036.** The AI chatbot, powered by the Gemini API, shall respond to general inquiries about services, pricing, business hours, and booking guidance.
- **REQ037.** The chatbot shall present predefined quick reply buttons upon opening a conversation.
- **REQ038.** The system shall automatically escalate a conversation to Sales and flag it as Awaiting Human Reply when the inquiry is beyond the chatbot's configured scope, job-specific, or a human agent is requested.
- **REQ039.** The system shall detect vehicle or job order status inquiries and flag the conversation with a Vehicle Status Inquiry indicator on the Sales Dashboard.
- **REQ040.** The chatbot shall have no access to private customer or job order data stored in the system.

### Messenger Inbox Module

- **REQ041.** The system shall display all customer Messenger conversations within the Sales Dashboard with conversation status, message preview, and time elapsed.
- **REQ042.** The system shall tag vehicle or job order status inquiry conversations with a distinct visual indicator.
- **REQ043.** The system shall allow Sales to view the full conversation thread and reply directly through Messenger.
- **REQ044.** The system shall update conversation status to Replied upon Sales response.
- **REQ045.** The Sales Dashboard shall display a Delay Notification Alert for any Delayed job where the customer has not yet been notified.
- **REQ046.** The Sales Dashboard shall display a Vehicle Status Inquiry Alert for any Messenger conversation awaiting a manual Sales response.
- **REQ047.** The system shall allow Sales to send a customer pickup notification through a pre-populated message template upon Head Technician approval and Operations marking the job as Completed. For jobs marked as Delayed by Operations, Sales shall notify the customer of the delay reason through Messenger.
- **REQ048.** The system shall allow Sales to create and customize notification message templates with dynamic placeholders: [Customer Name], [Sales Staff Name], [Plate Number], [Car Model], and [Service Type].

### Job Order Status Visibility (Sales)

- **REQ049.** The system shall allow Sales to view job order statuses in read-only mode, including current status, service stage progression, assigned technician, and job timeline, for the purpose of responding to customer vehicle and job order status inquiries through Messenger. Sales cannot create, edit, or change the status of any job order.

---

## 5. Non-Functional Requirements

### Operational Requirements

- **REQ050.** The system shall be accessible to authorized users 24/7, excluding scheduled maintenance.
- **REQ051.** The Head Technician and Technician interfaces shall be fully functional on standard mobile screen sizes.
- **REQ052.** The system shall support automated data backups for recovery in the event of failure.

### Performance Requirements

- **REQ053.** The system shall respond to user interactions within 10 seconds under normal operating conditions.
- **REQ054.** The Operations Dashboard, Sales Dashboard, Admin reporting modules, and all system interfaces shall load completely within 10 seconds.

### Security Requirements

- **REQ055.** All user passwords shall be stored using a secure hashing algorithm.
- **REQ056.** The system shall enforce HTTPS for all communications.
- **REQ057.** Access to role-restricted features shall be strictly limited to authenticated accounts with the corresponding role assignment.

### Cultural and Political Requirements

- **REQ058.** The system shall use Philippine Peso (₱) as the primary currency.
- **REQ059.** The system shall use English as the default language for all interfaces.
- **REQ060.** The system shall comply with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, and all other applicable Philippine regulations governing personal and operational data.

---

## CHANGE LOG FROM v2 TO v3

| Change | Description | Affected Sections |
|--------|-------------|-------------------|
| Estimated Service Duration | Admin now defines duration per service (in days); added to service configuration | Scope: Admin Service Mgmt; Reqs: REQ006, REQ007 |
| Auto-Generated Job Timeline | System calculates start date and expected completion from service duration + creation date; Operations no longer sets this manually | Scope: Operations Job Mgmt; Reqs: REQ007, REQ014, REQ015 |
| Operations Edit Scope Narrowed | Operations can only edit technician assignment and scheduled date/time; job timeline is now system-generated and non-editable | Scope: Operations Job Mgmt; Reqs: REQ015 |
| Pending Intake Indicator | Added to Operations Dashboard | Scope: Operations Dashboard; Reqs: REQ010 |
| Intake Cancellation | Operations can cancel intake with required reason; visible to Sales | Scope: Operations + Sales; Reqs: REQ011, REQ012 |
| Scheduled Booking Date | Added as intake field captured by Sales | Scope: Sales Intake; Reqs: REQ008, REQ009 |
| Reschedule Booking | Sales can update booking date with logged reason | Scope: Sales Intake; Reqs: REQ013 |
| View Job Order Status | Sales read-only access to job statuses for Messenger response | Scope: Sales modules; Reqs: REQ049 |
| No Availability Management | New limitation added | Scope: Limitations |
| Role Attribution Corrections | "admin" changed to "Sales" or "Operations" where applicable | Scope: Head Tech, Technician, Chatbot, Limitations |
| Total Requirements | Increased from 54 (v1) to 60 (v3) | Sections 4–5 |
