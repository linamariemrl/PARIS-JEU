import json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class FinanceSeedTests(unittest.TestCase):
    def test_voted_totals_and_no_fictional_debt(self):
        data=json.loads((ROOT/"public/data/finance/budget-paris.json").read_text())
        self.assertEqual(data["year"],2026)
        self.assertEqual(data["operating"]["expenseEUR"],10298594091)
        self.assertEqual(data["operating"]["revenueEUR"],10298594091)
        self.assertEqual(data["capital"]["expenseEUR"],2338878454)
        self.assertEqual(data["capital"]["revenueEUR"],2338878454)
        self.assertIsNone(data["debtOutstandingEUR"])
        self.assertTrue(data["debtOpeningReference"]["notCurrent"])
        self.assertEqual(data["debtOpeningReference"]["asOf"],"2026-01-01")
        self.assertIn("budget primitif",data["source"].lower())
