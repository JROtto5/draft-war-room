#!/usr/bin/env python3
"""Compatibility entry point for the local Node server and projection function."""
import pathlib
import subprocess
import sys

if __name__ == "__main__":
    raise SystemExit(subprocess.call(["node", str(pathlib.Path(__file__).with_suffix(".mjs")), *sys.argv[1:]]))
