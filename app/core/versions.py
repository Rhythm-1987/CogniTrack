"""
Single source of truth for the version strings stamped onto every
assessment session/result — see models/assessment.py and models/guest.py
(assessment_version, algorithm_version, game_version columns). Bump a
value here when that layer changes so future cross-version comparisons
(Sprint 8 CCI work) can tell which rows were scored/played under which
rules.
"""

ASSESSMENT_VERSION = '1.0'
# 1.1 = Sprint 9: cci.py hardened (malformed raw_data no longer crashes a
# dashboard read, a domain with no score no longer shows a confidence badge),
# attention false-starts added as a confidence factor, dashboard/history now
# prefer the CCI's domain scores over the legacy per-module scores. See
# research/CCI_Evidence_Map.md and research/CCI_Metric_Audit.md.
ALGORITHM_VERSION = '1.1'

# Per-module game version — bumped independently since each of the 5
# modules can be redesigned on its own schedule. Memory is 2.0 as of the
# Encoding -> Interference -> Recognition redesign (was the Trial1 ->
# Distraction -> Trial2 -> Recall -> Recognition flow at 1.0).
GAME_VERSIONS = {
    'memory': '2.0',
    'attention': '1.0',
    'executive': '1.0',
    'processing': '1.0',
    'spatial': '1.0',
}
