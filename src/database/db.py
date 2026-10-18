
import os

from dotenv import load_dotenv
from falkordb import FalkorDB

load_dotenv()


def get_graph():
    """Return a connection to the FraudWeave FalkorDB graph."""
    host = os.getenv("FALKORDB_HOST", "localhost")
    port = int(os.getenv("FALKORDB_PORT", "6379"))
    graph_name = os.getenv("FALKORDB_GRAPH", "fraudweave")
    password = os.getenv("FALKORDB_PASSWORD") or None

    db = FalkorDB(
        host=host,
        port=port,
        password=password,
    )

    return db.select_graph(graph_name)


def check_database():
    """Check database connectivity without changing graph data."""
    try:
        graph = get_graph()
        result = graph.query("RETURN 1 AS result")

        return {
            "connected": result.result_set == [[1]],
            "graph": os.getenv("FALKORDB_GRAPH", "fraudweave"),
        }
    except Exception as exc:
        return {
            "connected": False,
            "error": str(exc),
        }
