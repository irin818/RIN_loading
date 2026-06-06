"""Python candidate core for RIN.

The TypeScript implementation remains the production reference until an
owner-approved cutover. Python modules must default to provider-free behavior and
must not write to the owner's production `.rin-data`.
"""

from rin.version import __version__

__all__ = ["__version__"]
