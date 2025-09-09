import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pandas as pd
import json
import traceback

# Google API Setup
scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly"
]
creds = Credentials.from_service_account_info(
    st.secrets["google"]["service_account"],
    scopes=scopes
)
gc = gspread.authorize(creds)
drive_service = build("drive", "v3", credentials=creds)

SHEET_ID = st.secrets["google"]["lead_tracker_sheet_id"]
FOLDER_ID = st.secrets["google"]["folder_id"]
QUESTIONNAIRE_FILES = {
    'Probate': 'probate.txt',
    'Small Business': 'small_business.txt',
    'Estate Planning': 'estate_planning.txt',
    'Traffic/Criminal': 'traffic_criminal.txt'
}

# Expected columns in the Google Sheet
EXPECTED_COLUMNS = [
    "Email", "Name", "Phone", "Preferred Day", "Preferred Time",
    "Appointment Types", "Message", "Timestamp", "Followed Up",
    "ReminderSentAt", "ThreadId", "EventId", "MatchMethod",
    "ResponseReceived", "ExecutiveSummary"
]

# Authentication (Simple for MVP - replace with Firebase or Auth0 for production)
if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False

if not st.session_state["authenticated"]:
    st.title("Login to Lead Dashboard")
    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    if st.button("Login"):
        if username == st.secrets["auth"]["username"] and password == st.secrets["auth"]["password"]:
            st.session_state["authenticated"] = True
            st.rerun()
        else:
            st.error("Invalid credentials")
else:
    st.title("Lead Dashboard")

    # Fetch leads from Google Sheet
    try:
        sheet = gc.open_by_key(SHEET_ID).worksheet("Leads")
        data = sheet.get_all_values()
        if not data or len(data) < 1:
            st.error("No data found in the 'Leads' worksheet. Please add headers and data.")
            leads = pd.DataFrame()
        else:
            headers = [h.strip() for h in data[0]]  # Strip spaces from headers
            leads = pd.DataFrame(data[1:], columns=headers)
            # Check for missing columns
            missing_columns = [col for col in EXPECTED_COLUMNS if col not in leads.columns]
            if missing_columns:
                st.error(f"Missing columns in Google Sheet: {', '.join(missing_columns)}. Found: {', '.join(headers)}")
                leads = pd.DataFrame()
            else:
                # Convert data types
                leads["Timestamp"] = pd.to_datetime(leads["Timestamp"], errors='coerce')
                leads["Followed Up"] = leads["Followed Up"].apply(lambda x: x.lower() == 'true' if isinstance(x, str) else bool(x))
                leads["ResponseReceived"] = leads["ResponseReceived"].apply(lambda x: x.lower() == 'true' if isinstance(x, str) else bool(x))
    except Exception as e:
        st.error(f"Error fetching leads: {str(e)}\n\nStack trace:\n{traceback.format_exc()}")
        leads = pd.DataFrame()

    if not leads.empty:
        # Search and Filter
        search = st.text_input("Search by Name or Email")
        status_filter = st.selectbox("Status", ["All", "Pending", "Followed Up"])

        filtered_leads = leads.copy()
        if search:
            filtered_leads = filtered_leads[
                filtered_leads["Name"].str.lower().str.contains(search.lower(), na=False) |
                filtered_leads["Email"].str.lower().str.contains(search.lower(), na=False)
            ]
        if status_filter != "All":
            followed_up = status_filter == "Followed Up"
            filtered_leads = filtered_leads[filtered_leads["Followed Up"] == followed_up]

        # Display leads in table (all columns for flexibility)
        display_columns = [col for col in EXPECTED_COLUMNS if col in filtered_leads.columns]
        st.dataframe(filtered_leads[display_columns])

        # Detail view
        selected_email = st.selectbox("Select Lead to View Details", ["None"] + filtered_leads["Email"].tolist())
        if selected_email != "None":
            lead = filtered_leads[filtered_leads["Email"] == selected_email].iloc[0]
            st.write(f"**Name**: {lead['Name']}")
            st.write(f"**Email**: {lead['Email']}")
            st.write(f"**Phone**: {lead['Phone']}")
            st.write(f"**Preferred Day/Time**: {lead['Preferred Day']} {lead['Preferred Time']}")
            st.write(f"**Appointment Types**: {lead['Appointment Types']}")
            st.write(f"**Message**: {lead['Message']}")
            st.write(f"**Timestamp**: {lead['Timestamp']}")
            st.write(f"**Followed Up**: {'Yes' if lead['Followed Up'] else 'No'}")
            st.write(f"**Reminder Sent At**: {lead['ReminderSentAt'] if lead['ReminderSentAt'] else 'None'}")
            st.write(f"**Thread ID**: {lead['ThreadId'] if lead['ThreadId'] else 'None'}")
            st.write(f"**Event ID**: {lead['EventId'] if lead['EventId'] else 'None'}")
            st.write(f"**Match Method**: {lead['MatchMethod'] if lead['MatchMethod'] else 'None'}")
            st.write(f"**Response Received**: {'Yes' if lead['ResponseReceived'] else 'No'}")
            if st.secrets["apps_script"]["enable_ai_summary"] and "ExecutiveSummary" in lead and lead["ExecutiveSummary"]:
                st.write(f"**AI Executive Summary**: {lead['ExecutiveSummary']}")

            # Fetch questionnaire contents
            appointment_types = [t.strip() for t in lead['Appointment Types'].split(',') if t.strip()]
            questionnaire_contents = ""
            for type_ in appointment_types:
                file_name = QUESTIONNAIRE_FILES.get(type_, None)
                if file_name:
                    try:
                        # Search for file in folder
                        query = f"name='{file_name}' and '{FOLDER_ID}' in parents and trashed=false"
                        response = drive_service.files().list(q=query, fields="files(id, name)").execute()
                        files = response.get('files', [])
                        if files:
                            file_id = files[0]['id']
                            request = drive_service.files().get_media(fileId=file_id)
                            content = request.execute().decode('utf-8')
                            questionnaire_contents += f"{type_} Questionnaire\n\n{content}\n\n"
                        else:
                            questionnaire_contents += f"{type_} Questionnaire\n\nNo questionnaire available.\n\n"
                    except HttpError as e:
                        questionnaire_contents += f"{type_} Questionnaire\n\nError retrieving: {e}\n\n"
            if questionnaire_contents:
                st.write("**Questionnaires**:\n" + questionnaire_contents)
            else:
                st.write("No questionnaires available.")

            if st.button("Delete This Lead"):
                # Find row index (1-based, header is 1)
                row_index = leads[leads["Email"] == selected_email].index[0] + 2  # +1 header, +1 0-index
                sheet.delete_rows(row_index)
                st.success("Lead deleted successfully!")
                st.rerun()

    if st.button("Logout"):
        st.session_state["authenticated"] = False
        st.rerun()