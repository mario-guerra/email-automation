# Lead Management Dashboard Wireframes

## Dashboard Home

```
+--------------------------------------------------------------------+
|  LEAD MANAGEMENT DASHBOARD                           [User] Logout  |
+----------------+-----------------------------------------------+
| NAVIGATION     |  DASHBOARD OVERVIEW                           |
|                |                                               |
| [Dashboard]    |  +----------+  +----------+  +----------+     |
| [Leads]        |  | TOTAL    |  | NEW THIS |  | AWAITING |     |
| [Analytics]    |  | LEADS    |  | WEEK     |  | RESPONSE |     |
| [Settings]     |  | 124      |  | 18       |  | 32       |     |
|                |  +----------+  +----------+  +----------+     |
|                |                                               |
|                |  RECENT LEADS                                 |
|                |  +-------------------------------------------+|
|                |  | NAME    | EMAIL       | TYPE    | STATUS  ||
|                |  |---------|-------------|---------|---------|
|                |  | John D. | jd@mail.com | Probate | New     ||
|                |  | Sara M. | sm@mail.com | Estate  | Replied ||
|                |  | Luis V. | lv@mail.com | Small B.| Followed||
|                |  +-------------------------------------------+|
|                |                                               |
|                |  +-------------------+  +-------------------+ |
|                |  | LEAD VOLUME       |  | APPOINTMENT TYPES | |
|                |  | [Line chart]      |  | [Pie chart]       | |
|                |  |                   |  |                   | |
|                |  |                   |  |                   | |
|                |  +-------------------+  +-------------------+ |
+----------------+-----------------------------------------------+
```

## Lead Management Page

```
+--------------------------------------------------------------------+
|  LEAD MANAGEMENT                                    [User] Logout   |
+----------------+-----------------------------------------------+
| NAVIGATION     |  LEAD MANAGEMENT                              |
|                |                                               |
| [Dashboard]    |  +-------------------------------------------+|
| [Leads]        |  | Search: [____________] ⌕                  ||
| [Analytics]    |  | Status: [All ▼]  Type: [All ▼]  Date: [▼] ||
| [Settings]     |  +-------------------------------------------+|
|                |                                               |
|                |  +-------------------------------------------+|
|                |  | NAME    | EMAIL       | PHONE   | TYPE    ||
|                |  |---------|-------------|---------|---------|
|                |  | John D. | jd@mail.com | 555-123 | Probate ||
|                |  | Sara M. | sm@mail.com | 555-234 | Estate  ||
|                |  | Luis V. | lv@mail.com | 555-345 | Small B.||
|                |  | Emma K. | ek@mail.com | 555-456 | Traffic ||
|                |  | Mark T. | mt@mail.com | 555-567 | Probate ||
|                |  | Ana R.  | ar@mail.com | 555-678 | Estate  ||
|                |  | David L.| dl@mail.com | 555-789 | Small B.||
|                |  +-------------------------------------------+|
|                |                                               |
|                |  Showing 1-7 of 124 leads                     |
|                |  [◀ Previous] [1] [2] [3] [...] [18] [Next ▶] |
|                |                                               |
+----------------+-----------------------------------------------+
```

## Lead Detail View

```
+--------------------------------------------------------------------+
|  LEAD MANAGEMENT > JOHN DOE                         [User] Logout   |
+----------------+-----------------------------------------------+
| NAVIGATION     |  LEAD DETAILS                                 |
|                |                                               |
| [Dashboard]    |  +-------------------+  +-------------------+ |
| [Leads]        |  | CONTACT INFO      |  | APPOINTMENT INFO  | |
| [Analytics]    |  | Name: John Doe    |  | Types: Probate    | |
| [Settings]     |  | Email: jd@mail.com|  | Status: Awaiting  | |
|                |  | Phone: 555-123-456|  | Preferred: Mon PM | |
|                |  | Received: 9/8/25  |  | Followed Up: Yes  | |
|                |  +-------------------+  +-------------------+ |
|                |                                               |
|                |  TABS:                                        |
|                |  [Messages] [Questionnaires] [Timeline]       |
|                |                                               |
|                |  +-------------------------------------------+|
|                |  | ORIGINAL MESSAGE:                         ||
|                |  | I need help settling my father's estate.  ||
|                |  | He passed away last month and I'm not     ||
|                |  | sure where to begin with probate.         ||
|                |  |                                           ||
|                |  | EXECUTIVE SUMMARY:                        ||
|                |  | Client's father passed away recently.     ||
|                |  | Estate includes home and investments.     ||
|                |  | No will found yet. Client is sole heir.   ||
|                |  | Important points: Needs help locating     ||
|                |  | financial documents and determining next  ||
|                |  | steps in probate process.                 ||
|                |  +-------------------------------------------+|
|                |                                               |
|                |  [Mark Followed Up] [Send Email] [Schedule]   |
+----------------+-----------------------------------------------+
```

## Analytics Page

```
+--------------------------------------------------------------------+
|  LEAD ANALYTICS                                     [User] Logout   |
+----------------+-----------------------------------------------+
| NAVIGATION     |  ANALYTICS                                    |
|                |                                               |
| [Dashboard]    |  Time Range: [Last 30 Days ▼]                 |
| [Leads]        |                                               |
| [Analytics]    |  +----------+  +----------+  +----------+     |
| [Settings]     |  | LEADS    |  | RESPONSE |  | LEADS    |     |
|                |  | 42       |  | RATE     |  | PER DAY  |     |
|                |  |          |  | 68%      |  | 1.4      |     |
|                |  +----------+  +----------+  +----------+     |
|                |                                               |
|                |  +-------------------------------------------+|
|                |  | LEAD VOLUME OVER TIME                     ||
|                |  | [Line chart with trend line]              ||
|                |  |                                           ||
|                |  |                                           ||
|                |  +-------------------------------------------+|
|                |                                               |
|                |  +-------------------+  +-------------------+ |
|                |  | APPOINTMENT TYPES |  | LEAD STATUS       | |
|                |  | [Pie chart]       |  | [Funnel chart]    | |
|                |  | - Probate: 35%    |  | - Received: 42    | |
|                |  | - Estate: 25%     |  | - Followed Up: 38 | |
|                |  | - Small B.: 20%   |  | - Responded: 26   | |
|                |  | - Traffic: 20%    |  | - Scheduled: 15   | |
|                |  +-------------------+  +-------------------+ |
|                |                                               |
+----------------+-----------------------------------------------+
```

This wireframe document provides a visual representation of the four main pages of our Lead Management Dashboard MVP. The design focuses on clarity, simplicity, and providing the most relevant information for lawyers managing their leads.

The actual implementation in Streamlit may have slight variations based on the framework's capabilities and components available.
