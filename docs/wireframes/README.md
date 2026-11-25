# Wireframes

Low-fidelity screens from the design mockups. They show layout and content, not final styling. Values in `[brackets]` are placeholders. The small IDs printed on each screen point to the stories that own that part of the UI.

| Screen              | File                                                       | Stories shown                                                                |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Layout editor       | [1-layout-editor.png](1-layout-editor.png)                 | LE-1, LE-2, LE-3, LE-4, LE-5, EQ-1, EQ-2, EQ-3, FL-1, WS-1, WS-2, WS-3, TE-1 |
| Products & routings | [2-products-and-routings.png](2-products-and-routings.png) | PR-1, PR-2, PR-3, PR-4, WS-2                                                 |
| Simulation run      | [3-simulation-run.png](3-simulation-run.png)               | SE-2, SE-3, SE-4, SE-5, AN-1, AN-3, TE-2                                     |
| Results             | [4-results.png](4-results.png)                             | AN-1, AN-2, AN-3                                                             |

Shared shell: top bar with project name, tabs (Layout · Products & routings · Simulate · Results), save state and a primary "Run simulation" button. Left panel = library/list, centre = viewport or main content, right panel = properties/settings.

Colours used for meaning (keep them consistent; the values live in `apps/web/src/ui/tokens.ts`): station state working = green, starved = yellow, blocked = red, idle (shown as "Waiting for tech") = gray; tech walking = purple; products get user-chosen colours (blue/orange in mocks).
