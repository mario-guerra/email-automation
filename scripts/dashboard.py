import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials
from typing import Optional

# Optional interactive grid (st_aggrid)
try:
    from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode
    ST_AGRID_AVAILABLE = True
except Exception:
    AgGrid = None
    GridOptionsBuilder = None
    GridUpdateMode = None
    ST_AGRID_AVAILABLE = False

# Page configuration for better responsiveness
st.set_page_config(
    page_title="Lead Management Dashboard",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="auto"
)

# Updated CSS with readable text for metric cards
st.markdown("""
<style>
    /* Base styling */
    body {
        font-family: 'Arial', sans-serif;
        color: #333;
    }
    
    /* Main header */
    .main-header {
    color: #ffffff;
    font-size: 1.4rem;
    margin: 0.25rem 0 0.75rem 0;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    position: -webkit-sticky; /* Safari */
    position: sticky;
    top: 0;
    background: #0b1220; /* dark header */
    padding: 0.5rem 0.75rem;
    z-index: 999;
    }
    
    /* Metric card with dark text for readability */
    .metric-card {
    background-color: #f8f9fa;
    padding: 0.5rem;
        border-radius: 8px;
        border-left: 4px solid #1E88E5;
        margin-bottom: 1rem;
        text-align: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        color: #000; /* Explicitly set dark text color */
    }
    
    /* Ensure inner elements inherit dark text */
    .metric-card strong,
    .metric-card span {
        color: #000; /* Ensure strong and span tags use dark text */
    }
    
    /* Status badges */
    .status-new {
        background-color: #FFF3CD;
        color: #856404;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-size: 0.85rem;
    }
    
    .status-awaiting-response {
        background-color: #CCE5FF;
        color: #0056B3;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-size: 0.85rem;
    }
    
    .status-responded {
        background-color: #D4EDDA;
        color: #155724;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-size: 0.85rem;
    }
    
    .status-scheduled {
        background-color: #E2D9F3;
        color: #6F42C1;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        font-size: 0.85rem;
    }
    
    /* Sidebar styling */
    .sidebar .sidebar-content {
        background-color: #f8f9fa;
        padding: 1rem;
    }

    /* Compact the sidebar width so content area is dominant */
    section[data-testid="stSidebar"] {
        width: 200px !important;
        min-width: 200px !important;
        max-width: 200px !important;
    }
    
    .sidebar-nav button {
        width: 100%;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border-radius: 4px;
        font-weight: 500;
        transition: background-color 0.2s;
    }
    
    .sidebar-nav button:hover {
        background-color: #e0e0e0;
    }
    
    .sidebar-nav .active {
        background-color: #1E88E5;
        color: white;
        font-weight: bold;
    }
    
    /* Lead detail card */
    .lead-detail-card {
        background-color: #ffffff;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        margin-bottom: 1rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    /* Ensure inner elements inherit dark text */
    .lead-detail-card strong,
    .lead-detail-card span {
        color: #000; /* Ensure strong and span tags use dark text */
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
        .main-header {
            font-size: 1.5rem;
        }
        .metric-card {
            padding: 0.75rem;
        }
        .stButton > button {
            font-size: 0.9rem;
            padding: 0.5rem;
        }
        .stDataFrame {
            font-size: 0.85rem;
        }
        /* Stack columns on mobile */
        .stColumns > div {
            flex: 100% !important;
            max-width: 100% !important;
        }
    }
</style>
""", unsafe_allow_html=True)

class LeadDashboard:
    def __init__(self):
        self.init_session_state()
        self.setup_google_sheets()

    # --- UI helpers -------------------------------------------------
    def render_header(self):
        # Compact dark header with small logo and user badge
        col1, col2 = st.columns([6, 1])
        with col1:
            st.markdown('<div class="main-header">📈 <strong>Lead Management Dashboard</strong></div>', unsafe_allow_html=True)
        with col2:
            user = st.session_state.get('auth_name', '') or st.session_state.get('auth_username', '') or 'Demo'
            st.markdown(f"<div style='text-align:right;color:#bbb'>👤 {user}</div>", unsafe_allow_html=True)

    def compute_kpis(self, df: pd.DataFrame, start: datetime, end: datetime):
        # Return KPI numbers and a simple previous-period delta for demo purposes
        period_df = df[(df['Timestamp'] >= start) & (df['Timestamp'] <= end)] if len(df) > 0 else df
        total = len(period_df)
        awaiting = len(period_df[period_df['Status'] == 'Awaiting Response'])
        responses = len(period_df[period_df['Status'].isin(['Responded', 'Scheduled'])])

        # previous period
        period_days = max((end - start).days, 1)
        prev_start = start - timedelta(days=period_days)
        prev_end = start
        prev_df = df[(df['Timestamp'] >= prev_start) & (df['Timestamp'] < prev_end)] if len(df) > 0 else df
        prev_total = max(len(prev_df), 1)
        delta = (total - prev_total) / prev_total * 100 if prev_total else 0
        return {
            'total': total,
            'awaiting': awaiting,
            'responses': responses,
            'delta_total': delta
        }

    def add_initials_column(self, grid_df: pd.DataFrame) -> pd.DataFrame:
        def initials(name):
            if not name or pd.isna(name):
                return ''
            parts = str(name).split()
            if len(parts) == 1:
                return parts[0][0:2].upper()
            return (parts[0][0] + parts[-1][0]).upper()
        grid_df['Initials'] = grid_df['Name'].apply(initials)
        # Move initials to first column
        cols = list(grid_df.columns)
        cols.insert(0, cols.pop(cols.index('Initials')))
        return grid_df[cols]

    def _mini_sparkline(self, data_series):
        """Return a tiny Plotly sparkline figure for embedding in KPI cards."""
        if data_series is None or len(data_series) == 0:
            return None
        fig = px.line(x=list(range(len(data_series))), y=data_series, height=40)
        fig.update_traces(line=dict(width=1, color="#1E88E5"), marker=dict(size=0))
        fig.update_layout(margin=dict(l=0, r=0, t=0, b=0), paper_bgcolor='rgba(0,0,0,0)', plot_bgcolor='rgba(0,0,0,0)')
        fig.update_xaxes(visible=False)
        fig.update_yaxes(visible=False)
        return fig

    def render_compact_kpis(self, df: pd.DataFrame, start: datetime, end: datetime):
        """Render KPIs in a single compact row with optional sparklines."""
        kpis = self.compute_kpis(df, start, end)
        cols = st.columns(4)
        # For sparklines, use recent daily counts
        if len(df) > 0:
            daily = df[df['Timestamp'] >= (end - timedelta(days=30))].groupby(df['Timestamp'].dt.date).size().values
        else:
            daily = []
        metric_defs = [
            ("Total Leads", kpis['total'], kpis['delta_total']),
            ("New This Period", kpis['total'], None),
            ("Awaiting Response", kpis['awaiting'], None),
            ("Responses", kpis['responses'], None),
        ]
        for i, (label, value, delta) in enumerate(metric_defs):
            with cols[i]:
                st.markdown(f"<div style='padding:6px 0'><small style='color:#bbb'>{label}</small></div>", unsafe_allow_html=True)
                if delta is not None:
                    st.metric('', value, f"{delta:+.0f}%")
                else:
                    st.metric('', value)
                if i == 0 and len(daily) > 1:
                    fig = self._mini_sparkline(daily)
                    if fig:
                        st.plotly_chart(fig, use_container_width=True)
    
    def init_session_state(self):
        if 'authenticated' not in st.session_state:
            st.session_state.authenticated = False
        if 'current_page' not in st.session_state:
            st.session_state.current_page = 'Dashboard'
        if 'selected_lead_email' not in st.session_state:
            st.session_state.selected_lead_email = None
        if 'leads_data' not in st.session_state:
            st.session_state.leads_data = None
        if 'last_refresh' not in st.session_state:
            st.session_state.last_refresh = None
    
    def setup_google_sheets(self):
        try:
            if 'google' in st.secrets and 'service_account' in st.secrets['google']:
                credentials_info = dict(st.secrets['google']['service_account'])
                credentials = Credentials.from_service_account_info(
                    credentials_info,
                    scopes=[
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/drive'
                    ]
                )
                self.gc = gspread.authorize(credentials)
                self.sheet_id = st.secrets['google'].get('lead_tracker_sheet_id', '')
            else:
                st.error("Google Sheets credentials not configured.")
                self.gc = None
                self.sheet_id = None
        except Exception as e:
            st.error(f"Error setting up Google Sheets: {str(e)}")
            self.gc = None
            self.sheet_id = None
    
    def authenticate(self):
        """
        Authenticate the user. Prefer streamlit-authenticator when available and
        configured via `st.secrets['auth']`. Fall back to the simple built-in
        username/password form if streamlit-authenticator isn't installed or
        credentials are not provided.
        """
        # If already authenticated via previous run, short-circuit
        if st.session_state.get('authenticated'):
            return True

        # Try to use streamlit-authenticator if installed and configured
        try:
            import streamlit_authenticator as stauth
        except Exception:
            stauth = None

        auth_config = st.secrets.get('auth', None)

        if stauth and auth_config and 'credentials' in auth_config:
            try:
                credentials = auth_config.get('credentials')
                cookie_name = auth_config.get('cookie', {}).get('name', 'lead_dashboard')
                key = auth_config.get('cookie', {}).get('key', 'changeme')
                expiry_days = int(auth_config.get('cookie', {}).get('expiry_days', 30))

                # Create authenticator and show login widget
                self.authenticator = stauth.Authenticate(credentials, cookie_name, key, expiry_days)
                name, authentication_status, username = self.authenticator.login('Login', 'main')
                if authentication_status:
                    st.session_state.authenticated = True
                    st.session_state.auth_name = name
                    st.session_state.auth_username = username
                    return True
                elif authentication_status is False:
                    st.error('Username/password incorrect')
                    return False
                else:
                    # authentication_status is None -> user hasn't submitted form yet
                    return False
            except Exception as e:
                # If streamlit-authenticator usage fails, fall back to simple form
                st.warning(f"Auth setup error, falling back to simple login: {e}")

        # --- Fallback simple login form (kept for safety) ---
        st.markdown('<h1 class="main-header">🔐 Login</h1>', unsafe_allow_html=True)
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            st.markdown("### Enter Credentials")
            username = st.text_input("Username", placeholder="Enter username")
            password = st.text_input("Password", type="password", placeholder="Enter password")
            if st.button("Login", use_container_width=True, type="primary"):
                auth_username = st.secrets.get('auth', {}).get('username', 'admin')
                auth_password = st.secrets.get('auth', {}).get('password', 'password')
                if username == auth_username and password == auth_password:
                    st.session_state.authenticated = True
                    st.rerun()
                else:
                    st.error("Invalid credentials")
        return False
    
    def load_leads_data(self, force_refresh=False) -> Optional[pd.DataFrame]:
        if not self.gc or not self.sheet_id:
            return self.create_sample_data()
        now = datetime.now()
        if (not force_refresh and 
            st.session_state.leads_data is not None and 
            st.session_state.last_refresh is not None and 
            (now - st.session_state.last_refresh).seconds < 300):
            return st.session_state.leads_data
        try:
            sheet = self.gc.open_by_key(self.sheet_id).worksheet('Leads')
            data = sheet.get_all_records()
            if not data:
                return self.create_sample_data()
            df = pd.DataFrame(data)
            df = self.process_leads_data(df)
            st.session_state.leads_data = df
            st.session_state.last_refresh = now
            return df
        except Exception as e:
            st.error(f"Error loading data: {str(e)}")
            return self.create_sample_data()
    
    def process_leads_data(self, df: pd.DataFrame) -> pd.DataFrame:
        if 'Timestamp' in df.columns:
            df['Timestamp'] = pd.to_datetime(df['Timestamp'], errors='coerce')
        bool_columns = ['Followed Up', 'ResponseReceived']
        for col in bool_columns:
            if col in df.columns:
                df[col] = df[col].astype(str).str.lower().isin(['true', '1', 'yes'])
        df['Status'] = df.apply(self.determine_status, axis=1)
        if 'Appointment Types' in df.columns:
            df['Appointment Types'] = df['Appointment Types'].fillna('')
        string_columns = ['Email', 'Name', 'Phone', 'Preferred Day', 'Preferred Time', 'Message']
        for col in string_columns:
            if col in df.columns:
                df[col] = df[col].fillna('')
        return df
    
    def determine_status(self, row) -> str:
        if pd.isna(row.get('Followed Up')) or not row.get('Followed Up'):
            return 'New'
        elif row.get('ResponseReceived', False):
            if row.get('EventId', '') or 'scheduled' in str(row.get('ExecutiveSummary', '')).lower():
                return 'Scheduled'
            return 'Responded'
        else:
            return 'Awaiting Response'
    
    def create_sample_data(self) -> pd.DataFrame:
        sample_data = [
            {
                'Email': 'john.doe@email.com',
                'Name': 'John Doe',
                'Phone': '555-123-4567',
                'Preferred Day': 'Monday',
                'Preferred Time': 'Afternoon',
                'Appointment Types': 'Probate',
                'Message': 'Need help with father\'s estate settlement',
                'Timestamp': datetime.now() - timedelta(days=2),
                'Followed Up': True,
                'ResponseReceived': False,
                'ExecutiveSummary': 'Client needs probate assistance.'
            },
            {
                'Email': 'sara.miller@email.com',
                'Name': 'Sara Miller',
                'Phone': '555-234-5678',
                'Preferred Day': 'Tuesday',
                'Preferred Time': 'Morning',
                'Appointment Types': 'Estate Planning',
                'Message': 'Want to create a will and trust',
                'Timestamp': datetime.now() - timedelta(days=1),
                'Followed Up': True,
                'ResponseReceived': True,
                'ExecutiveSummary': 'Client interested in estate planning.'
            },
            {
                'Email': 'luis.valdez@email.com',
                'Name': 'Luis Valdez',
                'Phone': '555-345-6789',
                'Preferred Day': 'Wednesday',
                'Preferred Time': 'Evening',
                'Appointment Types': 'Small Business',
                'Message': 'Need LLC formation assistance',
                'Timestamp': datetime.now() - timedelta(hours=6),
                'Followed Up': False,
                'ResponseReceived': False,
                'ExecutiveSummary': ''
            }
        ]
        df = pd.DataFrame(sample_data)
        df['Status'] = df.apply(self.determine_status, axis=1)
        return df
    
    def render_sidebar(self):
        """Render a clean, responsive sidebar with clear active state."""
        with st.sidebar:
            st.markdown("### 📊 Navigation", unsafe_allow_html=True)
            pages = ['Dashboard', 'Lead Management', 'Lead Details', 'Analytics']
            for page in pages:
                button_style = "active" if st.session_state.current_page == page else ""
                icon = "📋" if page != 'Analytics' else "📈"
                if st.button(f"{icon} {page}", key=f"nav_{page}", 
                           help=f"Go to {page}", 
                           use_container_width=True,
                           type="primary" if st.session_state.current_page == page else "secondary"):
                    st.session_state.current_page = page
                    if page != 'Lead Details':
                        st.session_state.selected_lead_email = None
                    st.rerun()
            
            st.markdown("---")
            if st.button("🔄 Refresh Data", use_container_width=True, type="secondary"):
                st.session_state.leads_data = None
                st.session_state.last_refresh = None
                st.rerun()
            
            if st.button("🚪 Logout", use_container_width=True, type="secondary"):
                st.session_state.authenticated = False
                st.rerun()
            
            if st.session_state.last_refresh:
                st.markdown(f"**Last Updated:** {st.session_state.last_refresh.strftime('%H:%M:%S')}")
    
    def render_dashboard_home(self, df: pd.DataFrame):
        """Render a simplified, organized home page."""
        st.markdown('<h1 class="main-header">📊 Lead Management Dashboard</h1>', unsafe_allow_html=True)
        # Period selector for KPIs
        period = st.selectbox('Time Range', ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time'], index=0)
        total_leads = len(df)

        # Determine date range
        end = datetime.now()
        if period == 'Last 7 Days':
            start = end - timedelta(days=7)
        elif period == 'Last 30 Days':
            start = end - timedelta(days=30)
        elif period == 'Last 90 Days':
            start = end - timedelta(days=90)
        else:
            start = df['Timestamp'].min() if len(df) > 0 else end - timedelta(days=30)

        period_df = df[df['Timestamp'] >= start] if len(df) > 0 else df
        new_this_week = len(period_df)
        awaiting_response = len(period_df[period_df['Status'] == 'Awaiting Response'])
        responses_received = len(period_df[period_df['Status'].isin(['Responded', 'Scheduled'])])

        # Compact KPI strip
        self.render_compact_kpis(df, start, end)
        
        # Recent leads and charts in expandable sections
        with st.expander("Recent Leads", expanded=True):
            recent_df = df.head(10)[['Name', 'Email', 'Appointment Types', 'Timestamp', 'Status']]
            recent_df['Date'] = recent_df['Timestamp'].dt.strftime('%m/%d/%y')
            display_df = recent_df[['Name', 'Email', 'Appointment Types', 'Date', 'Status']].copy()
            
            for idx, row in display_df.iterrows():
                # Two-line compact row: summary on first line, status+actions on second.
                left, right = st.columns([8, 1])
                with left:
                    st.markdown(f"**{row['Name']}**  —  <a href='mailto:{row['Email']}' style='color:#8ab4ff'>{row['Email']}</a>  •  {row['Appointment Types']}  <span style='color:#777'>| {row['Date']}</span>", unsafe_allow_html=True)
                with right:
                    # small inline chevron button to open details
                    if st.button('▸', key=f"open_{idx}_{row['Email']}", help='View details'):
                        st.session_state.selected_lead_email = row['Email']
                        st.session_state.current_page = 'Lead Details'
                        st.rerun()
                # second line: status badge + small follow-up action
                s1, s2 = st.columns([8, 1])
                with s1:
                    st.markdown(f"<span class='status-{row['Status'].lower().replace(' ', '-')}'>{row['Status']}</span>", unsafe_allow_html=True)
                with s2:
                    if st.button('✉️', key=f"follow_{idx}_{row['Email']}", help='Mark followed up'):
                        # placeholder action: set Followed Up flag in session for demo
                        st.success('Marked followed up (demo)')
                st.markdown('---')
        
        with st.expander("Lead Insights", expanded=True):
            col1, col2 = st.columns([1, 1])
            with col1:
                st.markdown("#### Lead Status Distribution")
                status_counts = df['Status'].value_counts()
                if not status_counts.empty:
                    fig = px.pie(values=status_counts.values, names=status_counts.index,
                               color_discrete_map={
                                   'New': '#FFC107',
                                   'Awaiting Response': '#03A9F4',
                                   'Responded': '#4CAF50',
                                   'Scheduled': '#9C27B0'
                               })
                    fig.update_layout(height=300, showlegend=True)
                    st.plotly_chart(fig, use_container_width=True)
            
            with col2:
                st.markdown("#### Daily Lead Volume")
                if len(df) > 0:
                    daily_leads = df.groupby(df['Timestamp'].dt.date).size().reset_index()
                    daily_leads.columns = ['Date', 'Leads']
                    fig = px.line(daily_leads, x='Date', y='Leads', markers=True)
                    fig.update_layout(height=300)
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("No data available")
    
    def render_lead_management(self, df: pd.DataFrame):
        """Render a clean lead management page with improved filters."""
        st.markdown('<h1 class="main-header">👥 Lead Management</h1>', unsafe_allow_html=True)
        
        # Simplified filter layout, stacked on mobile via CSS
        # Live filters (apply immediately)
        col1, col2, col3 = st.columns([2, 1, 1])
        with col1:
            search_term = st.text_input("🔍 Search", placeholder="Name or email...")
        with col2:
            status_filter = st.selectbox("Status", ['All'] + list(df['Status'].unique()))
        with col3:
            all_types = set()
            for types_str in df['Appointment Types'].fillna(''):
                if types_str:
                    all_types.update([t.strip() for t in types_str.split(',')])
            type_filter = st.selectbox("Service Type", ['All'] + sorted(list(all_types)))
        
        # Apply filters
        filtered_df = df.copy()
        if search_term:
            mask = (df['Name'].str.contains(search_term, case=False, na=False) |
                   df['Email'].str.contains(search_term, case=False, na=False))
            filtered_df = filtered_df[mask]
        if status_filter != 'All':
            filtered_df = filtered_df[filtered_df['Status'] == status_filter]
        if type_filter != 'All':
            mask = filtered_df['Appointment Types'].str.contains(type_filter, case=False, na=False)
            filtered_df = filtered_df[mask]
        
        st.markdown(f"### Showing {len(filtered_df)} of {len(df)} leads")

        if len(filtered_df) > 0:
            if ST_AGRID_AVAILABLE:
                try:
                    # local import to keep static analysis happy and ensure symbols are available
                    from st_aggrid import AgGrid as _AgGrid, GridOptionsBuilder as _GridOptionsBuilder, GridUpdateMode as _GridUpdateMode
                except Exception:
                    _AgGrid = None
                    _GridOptionsBuilder = None
                    _GridUpdateMode = None
                if _AgGrid is not None and _GridOptionsBuilder is not None and _GridUpdateMode is not None:
                    # Prepare DataFrame for AgGrid
                    grid_df = filtered_df.copy()
                    # Format timestamp for display
                    if 'Timestamp' in grid_df.columns:
                        grid_df['Timestamp'] = grid_df['Timestamp'].dt.strftime('%Y-%m-%d %H:%M')

                    gb = _GridOptionsBuilder.from_dataframe(grid_df)
                    gb.configure_pagination(paginationAutoPageSize=False, paginationPageSize=10)
                    gb.configure_selection('single')
                    gb.configure_default_column(filter=True, sortable=True, resizable=True)
                    grid_options = gb.build()

                    grid_response = _AgGrid(
                        grid_df,
                        gridOptions=grid_options,
                        update_mode=_GridUpdateMode.SELECTION_CHANGED,
                        allow_unsafe_jscode=True,
                        fit_columns_on_grid_load=True,
                    )

                    selected = grid_response.get('selected_rows', [])
                    if selected:
                        sel = selected[0]
                        if st.button('View Selected Lead'):
                            st.session_state.selected_lead_email = sel.get('Email')
                            st.session_state.current_page = 'Lead Details'
                            st.rerun()

                    # CSV export
                    csv = grid_df.to_csv(index=False)
                    st.download_button('Export CSV', csv, file_name='leads_export.csv', mime='text/csv')
            else:
                for idx, row in filtered_df.iterrows():
                    col1, col2 = st.columns([3, 1])
                    with col1:
                        st.markdown(f"""
                        **{row['Name']}** | {row['Email']}<br>
                        {row['Appointment Types']} | {row['Timestamp'].strftime('%m/%d/%y %H:%M')}<br>
                        <span class="status-{row['Status'].lower().replace(' ', '-')}">{row['Status']}</span>
                        """, unsafe_allow_html=True)
                    with col2:
                        # include index to ensure unique widget keys when same email appears multiple times
                        if st.button("View", key=f"view_lead_{row['Email']}_{idx}", use_container_width=True):
                            st.session_state.selected_lead_email = row['Email']
                            st.session_state.current_page = 'Lead Details'
                            st.rerun()
                    st.markdown("---")
    
    def render_lead_details(self, df: pd.DataFrame):
        """Render a clean lead details page with tabbed layout."""
        if not st.session_state.selected_lead_email:
            st.warning("No lead selected.")
            return
        lead_row = df[df['Email'] == st.session_state.selected_lead_email]
        if lead_row.empty:
            st.error("Lead not found.")
            return
        lead = lead_row.iloc[0]
        
        st.markdown(f'<h1 class="main-header">👤 {lead["Name"]}</h1>', unsafe_allow_html=True)
              
        col1, col2 = st.columns([1, 1])
        with col1:
            st.markdown(f"""
            <div class="lead-detail-card">
                <h4><strong>Contact Information</strong></h4>
                <strong>Name: {lead['Name']}<br></strong>
                <strong>Email: {lead['Email']}<br></strong>
                <strong>Phone: {lead['Phone']}<br></strong>
                <strong>Received: {lead['Timestamp'].strftime('%m/%d/%Y %H:%M') if pd.notna(lead['Timestamp']) else 'N/A'}</strong>
            </div>
            """, unsafe_allow_html=True)
        
        with col2:
            st.markdown(f"""
            <div class="lead-detail-card">
                <h4><strong>Appointment Information</strong></h4>
                <strong>Services:</strong> {lead['Appointment Types']}<br>
                <strong>Preferred Day:</strong> {lead['Preferred Day']}<br>
                <strong>Preferred Time:</strong> {lead['Preferred Time']}<br>
                <strong>Status:</strong> <span class="status-{lead['Status'].lower().replace(' ', '-')}">{lead['Status']}</span>
            </div>
            """, unsafe_allow_html=True)
        
        tab1, tab2, tab3 = st.tabs(["💬 Messages", "📋 Summary", "📈 Timeline"])
        with tab1:
            st.markdown(f"""
            <div class="lead-detail-card">
                <h4><strong>Original Message</strong></h4>
                <strong>{lead['Message']}</strong>
            </div>
            """, unsafe_allow_html=True)
            if lead.get('Followed Up', False):
                st.success("✅ Initial follow-up sent")
                if lead.get('ResponseReceived', False):
                    st.success("✅ Client has responded")
                else:
                    st.info("⏳ Awaiting client response")
        
        with tab2:
            if lead.get('ExecutiveSummary'):
                st.markdown(f"""
                <div class="lead-detail-card">
                    <h4><strong>AI Executive Summary</strong></h4>
                    <strong>{lead['ExecutiveSummary']}</strong>
                </div>
                """, unsafe_allow_html=True)
            else:
                st.info("No summary available.")
        
        with tab3:
            st.markdown("### Communication Timeline")
            timeline_events = [
                {'date': lead['Timestamp'], 'event': '📧 Initial Contact', 'description': f"Lead submitted form for {lead['Appointment Types']}"}
            ]
            if lead.get('Followed Up', False):
                timeline_events.append({
                    'date': lead['Timestamp'] + timedelta(minutes=5),
                    'event': '📤 Welcome Email Sent',
                    'description': 'Automated welcome email sent'
                })
            if lead.get('ResponseReceived', False):
                timeline_events.append({
                    'date': lead['Timestamp'] + timedelta(hours=12),
                    'event': '📥 Client Response',
                    'description': 'Client responded to questionnaire'
                })
            for event in sorted(timeline_events, key=lambda x: x['date']):
                st.markdown(f"""
                **{event['date'].strftime('%m/%d/%Y %H:%M')}** - {event['event']}<br>
                {event['description']}
                """)
                st.markdown("---")
        
        st.markdown("### 🔧 Actions")
        cols = st.columns(3)
        with cols[0]:
            if not lead.get('Followed Up', False):
                st.button("✉️ Mark as Followed Up", use_container_width=True)
        with cols[1]:
            st.button("📧 Send Email", use_container_width=True)
        with cols[2]:
            st.markdown(f"[📅 Schedule Consultation]({st.secrets.get('apps_script', {}).get('calendly_link', 'https://calendly.com')})")
        
        if st.button("← Back to Lead Management", use_container_width=True):
            st.session_state.current_page = 'Lead Management'
            st.session_state.selected_lead_email = None
            st.rerun()
    
    def render_analytics(self, df: pd.DataFrame):
        """Render a streamlined analytics page."""
        st.markdown('<h1 class="main-header">📊 Analytics Dashboard</h1>', unsafe_allow_html=True)
        
        with st.form(key="analytics_filters"):
            date_range = st.selectbox("Time Range", ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'All Time'])
            st.form_submit_button("Apply")
        
        end_date = datetime.now()
        if date_range == 'Last 7 Days':
            start_date = end_date - timedelta(days=7)
        elif date_range == 'Last 30 Days':
            start_date = end_date - timedelta(days=30)
        elif date_range == 'Last 90 Days':
            start_date = end_date - timedelta(days=90)
        else:
            start_date = df['Timestamp'].min() if len(df) > 0 else end_date - timedelta(days=30)
        filtered_df = df[df['Timestamp'] >= start_date] if len(df) > 0 else df
        
        cols = st.columns(4)
        total_leads = len(filtered_df)
        followed_up = len(filtered_df[filtered_df.get('Followed Up', False) == True])
        responses = len(filtered_df[filtered_df.get('ResponseReceived', False) == True])
        response_rate = (responses / followed_up * 100) if followed_up > 0 else 0
        leads_per_day = total_leads / max((end_date - start_date).days, 1)
        conversion_rate = (len(filtered_df[filtered_df['Status'] == 'Scheduled']) / total_leads * 100) if total_leads > 0 else 0
        
        metrics = [
            ("Total Leads", total_leads),
            ("Response Rate", f"{response_rate:.1f}%"),
            ("Leads/Day", f"{leads_per_day:.1f}"),
            ("Conversion Rate", f"{conversion_rate:.1f}%")
        ]
        
        for i, (label, value) in enumerate(metrics):
            with cols[i]:
                st.markdown(f"""
                <div class="metric-card">
                    <strong>{label}</strong><br>
                    <span style="font-size: 1.5rem;">{value}</span>
                </div>
                """, unsafe_allow_html=True)
        
        with st.expander("Lead Trends", expanded=True):
            col1, col2 = st.columns([1, 1])
            with col1:
                st.markdown("#### Lead Volume Trend")
                if len(filtered_df) > 0:
                    daily_leads = filtered_df.groupby(filtered_df['Timestamp'].dt.date).size().reset_index()
                    daily_leads.columns = ['Date', 'Leads']
                    fig = px.line(daily_leads, x='Date', y='Leads', markers=True)
                    fig.update_layout(height=300)
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("No data for selected time range")
            
            with col2:
                st.markdown("#### Lead Status Funnel")
                if len(filtered_df) > 0:
                    status_counts = filtered_df['Status'].value_counts()
                    fig = go.Figure(go.Funnel(
                        y=status_counts.index,
                        x=status_counts.values,
                        textinfo="value+percent initial"
                    ))
                    fig.update_layout(height=300)
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("No data for selected time range")
    
    def run(self):
        # Authenticate first
        if not self.authenticate():
            return

        # Load data
        df = self.load_leads_data()
        if df is None:
            st.error("Unable to load leads data.")
            return

        # Render global header and sidebar
        self.render_header()
        self.render_sidebar()

        # Page dispatch
        if st.session_state.current_page == 'Dashboard':
            self.render_dashboard_home(df)
        elif st.session_state.current_page == 'Lead Management':
            self.render_lead_management(df)
        elif st.session_state.current_page == 'Lead Details':
            self.render_lead_details(df)
        elif st.session_state.current_page == 'Analytics':
            self.render_analytics(df)

if __name__ == "__main__":
    dashboard = LeadDashboard()
    dashboard.run()