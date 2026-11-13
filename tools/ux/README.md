# Scroll mechanics checks ("How we work")

Automated checks of how much text is readable and where gestures come to rest.
They measure mechanics, not comprehension: see the audit doc for the user-test plan.

Build a static preview first (`node tools/preview/build.mjs`), then:

```bash
# readable scroll per step, sampled every 8px
python3 tools/ux/measure.py dist-preview out.json 1440 900 && python3 tools/ux/report.py out.json
# wheel / trackpad-flick / Page Down, forwards and backwards
python3 tools/ux/gestures.py dist-preview rebuilt
python3 tools/ux/gestures_back.py dist-preview rebuilt
# phone (stacked layout), emulated momentum scrolling
python3 tools/ux/touch.py dist-preview rebuilt
```

Needs Python Playwright and Chrome at /usr/bin/google-chrome.
