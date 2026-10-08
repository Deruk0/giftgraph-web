"""GiftGraph cloud application. The bot and graph builder run on the PC."""
import os
os.environ.setdefault("GIFTGRAPH_STORAGE", "blob")
from site_server import app
