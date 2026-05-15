"""
Seed script — run once to populate Milvus with sample portfolio data
and set initial client communication preferences.

Usage:
    cd backend
    python -m app.scripts.seed_data
"""

from app.services import memory, registry, vector

EMP1_DOCS = [
    {
        "portfolio_owner": "emp_1",
        "client_id":       "client_rahul",
        "document_type":   "portfolio_summary",
        "document_id":     "e1_rahul_summary",
        "content": (
            "Client: Rahul | Employee: emp_1\n"
            "Portfolio Summary (Jan 2026):\n"
            "- Mutual Funds: Rs 20,00,000 (SBI Bluechip, HDFC Mid-Cap)\n"
            "- Fixed Deposits: Rs 10,00,000 (SBI, 7.1% p.a., 3yr)\n"
            "- Real Estate: Rs 50,00,000 (Residential, Pune)\n"
            "Total AUM: Rs 80,00,000\n"
            "Risk Profile: Moderate\n"
            "Investment Goal: Wealth accumulation & retirement by 2040"
        ),
    },
    {
        "portfolio_owner": "emp_1",
        "client_id":       "client_rahul",
        "document_type":   "weekly_performance",
        "document_id":     "e1_rahul_weekly",
        "content": (
            "Client: Rahul | Week ending 10-Jan-2026\n"
            "- Mutual Funds: +2.3% WoW (SBI Bluechip outperforming Nifty by 0.8%)\n"
            "- FD interest accrued: Rs 1,365 this week\n"
            "- Real Estate: No change (long-term hold)\n"
            "Net weekly gain: Rs 47,600\n"
            "Recommendation: Consider increasing SIP by Rs 5,000/month"
        ),
    },
    {
        "portfolio_owner": "emp_1",
        "client_id":       "client_priya",
        "document_type":   "portfolio_summary",
        "document_id":     "e1_priya_summary",
        "content": (
            "Client: Priya | Employee: emp_1\n"
            "Portfolio Summary (Jan 2026):\n"
            "- Mutual Funds: Rs 15,00,000 (Axis Long Term Equity, Mirae Asset)\n"
            "- Fixed Deposits: Rs 8,00,000 (HDFC Bank, 6.9% p.a.)\n"
            "- Gold ETF: Rs 5,00,000 (Nippon India Gold ETF)\n"
            "- PPF: Rs 3,00,000\n"
            "Total AUM: Rs 31,00,000\n"
            "Risk Profile: Conservative-Moderate\n"
            "Investment Goal: Children education fund (2032) & home purchase (2028)"
        ),
    },
    {
        "portfolio_owner": "emp_1",
        "client_id":       "client_priya",
        "document_type":   "weekly_performance",
        "document_id":     "e1_priya_weekly",
        "content": (
            "Client: Priya | Week ending 10-Jan-2026\n"
            "- Mutual Funds: +1.7% WoW (Axis Long Term Equity led gains)\n"
            "- Gold ETF: +0.5% (USD weakness driving gold)\n"
            "- FD: Steady\n"
            "- PPF contribution this month: Rs 12,500\n"
            "Net weekly gain: Rs 32,100\n"
            "Status: On track for 2028 home purchase goal"
        ),
    },
    {
        "portfolio_owner": "emp_1",
        "client_id":       "general",
        "document_type":   "business_context",
        "document_id":     "e1_business_context",
        "content": (
            "Employee 1 Book Overview (Jan 2026):\n"
            "- Clients: Rahul, Priya\n"
            "- Combined AUM: Rs 1,11,00,000\n"
            "- Focus: Moderate-risk retail investors, real estate-heavy portfolios\n"
            "- Products: Mutual Funds, FDs, Real Estate, Gold ETF, PPF\n"
            "- Avg portfolio tenure: 4 years"
        ),
    },
]

EMP2_DOCS = [
    {
        "portfolio_owner": "emp_2",
        "client_id":       "client_arjun",
        "document_type":   "portfolio_summary",
        "document_id":     "e2_arjun_summary",
        "content": (
            "Client: Arjun | Employee: emp_2\n"
            "Portfolio Summary (Jan 2026):\n"
            "- Equity (Stocks): Rs 25,00,000 (Infosys, TCS, Reliance, HDFC Bank)\n"
            "- Bonds: Rs 10,00,000 (GOI 7.26% 2032, AAA Corp bonds)\n"
            "- Gold Sovereign Bonds: Rs 3,00,000\n"
            "- NPS Retirement: Rs 7,00,000 (Tier-1)\n"
            "Total AUM: Rs 45,00,000\n"
            "Risk Profile: Aggressive\n"
            "Investment Goal: Early retirement 2035, passive income Rs 1L/month"
        ),
    },
    {
        "portfolio_owner": "emp_2",
        "client_id":       "client_arjun",
        "document_type":   "weekly_performance",
        "document_id":     "e2_arjun_weekly",
        "content": (
            "Client: Arjun | Week ending 10-Jan-2026\n"
            "- Equity: +3.1% WoW (Infosys +4.2% on strong Q3 guidance)\n"
            "- Bonds: Stable, yield 7.1%\n"
            "- Gold SGB: +0.8%\n"
            "- NPS NAV: Rs 7,18,000\n"
            "Net weekly gain: Rs 83,500\n"
            "Risk Alert: Equity at 56% — above target 50%. Consider rebalancing Rs 2.5L to bonds.\n"
            "Recommendation: Hold Infosys, review Reliance after Q3 results"
        ),
    },
    {
        "portfolio_owner": "emp_2",
        "client_id":       "client_meera",
        "document_type":   "portfolio_summary",
        "document_id":     "e2_meera_summary",
        "content": (
            "Client: Meera | Employee: emp_2\n"
            "Portfolio Summary (Jan 2026):\n"
            "- Equity (Stocks): Rs 12,00,000 (Bluechip, diversified sectors)\n"
            "- Corporate Bonds: Rs 6,00,000 (Tata Capital, L&T Finance)\n"
            "- Gold ETF: Rs 2,00,000\n"
            "- NPS Retirement: Rs 5,50,000 (Tier-1 + Tier-2)\n"
            "Total AUM: Rs 25,50,000\n"
            "Risk Profile: Moderate-Aggressive\n"
            "Investment Goal: Retirement corpus Rs 2 Cr by 2038"
        ),
    },
    {
        "portfolio_owner": "emp_2",
        "client_id":       "client_meera",
        "document_type":   "weekly_performance",
        "document_id":     "e2_meera_weekly",
        "content": (
            "Client: Meera | Week ending 10-Jan-2026\n"
            "- Equity: +2.6% WoW (broad market rally)\n"
            "- Bonds: +0.2% mark-to-market\n"
            "- Gold ETF: +0.5%\n"
            "- NPS contribution this month: Rs 10,000\n"
            "Net weekly gain: Rs 37,200\n"
            "YTD return: 11.4% (on track for 12% annual target)\n"
            "Recommendation: Increase NPS Tier-2 for additional tax benefit"
        ),
    },
    {
        "portfolio_owner": "emp_2",
        "client_id":       "general",
        "document_type":   "business_context",
        "document_id":     "e2_business_context",
        "content": (
            "Employee 2 Book Overview (Jan 2026):\n"
            "- Clients: Arjun, Meera\n"
            "- Combined AUM: Rs 70,50,000\n"
            "- Focus: Equity-first aggressive growth, retirement planning\n"
            "- Products: Equities, Bonds, NPS, Gold ETF\n"
            "- Avg portfolio tenure: 2.5 years"
        ),
    },
]

CLIENT_PREFS = [
    {
        "client_id":  "client_rahul",
        "preference": "Rahul prefers weekly investment updates in short bullet points with simple language, avoiding financial jargon. Keep it under 150 words.",
    },
    {
        "client_id":  "client_priya",
        "preference": "Priya prefers detailed PDF-style reports with full breakdown of each investment, performance description, risk assessment, and forward recommendations.",
    },
    {
        "client_id":  "client_arjun",
        "preference": "Arjun prefers email-style summaries with clear risk highlights, rebalancing alerts, and specific stock-level commentary. Include action items.",
    },
    {
        "client_id":  "client_meera",
        "preference": "Meera prefers simple performance-only summaries: total value, weekly gain/loss percentage, one-line status per asset class. No jargon.",
    },
]


def seed():
    # 1. Make sure the registry is populated. The registry service writes
    #    its default super_admin + emp_1 + emp_2 + clients on first access.
    print(f"Registry: {len(registry.all_users())} users, "
          f"{len(registry.all_clients())} clients")

    # 2. Vector store
    print("Seeding Milvus with portfolio documents...")
    for doc in EMP1_DOCS + EMP2_DOCS:
        try:
            vector.insert_document(
                portfolio_owner=doc["portfolio_owner"],
                client_id=doc["client_id"],
                document_type=doc["document_type"],
                content=doc["content"],
                document_id=doc.get("document_id"),
            )
            print(f"  [OK] {doc['document_id']}")
        except Exception as e:
            print(f"  [WARN] {doc.get('document_id', '?')}: {e}")

    # 3. Client communication preferences
    print("\nSeeding client communication preferences...")
    for pref in CLIENT_PREFS:
        try:
            memory.set_client_preference(pref["client_id"], pref["preference"], "super_admin")
            print(f"  [OK] {pref['client_id']}")
        except Exception as e:
            print(f"  [WARN] {pref['client_id']}: {e}")

    print("\nDone! Run: uvicorn app.main:app --reload --port 8000")


if __name__ == "__main__":
    seed()
