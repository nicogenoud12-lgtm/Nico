"""Hace importable el paquete `app` al correr pytest desde backend/."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
