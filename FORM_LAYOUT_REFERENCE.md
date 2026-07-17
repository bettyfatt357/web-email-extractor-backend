# Business Discovery Form - Layout Reference

## Proposed UI Structure

### Mode Toggle (At Top)
```
[Simple Search] [Advanced Search] ← Toggle tabs/buttons
```

---

## SIMPLE MODE (Current - No Changes)

```
┌─────────────────────────────────────┐
│ Search Query                        │
├─────────────────────────────────────┤
│ Enter your search query              │
│                                     │
│ ┌───────────────────────────────┐   │
│ │ e.g., tech startups san fran. │   │
│ └───────────────────────────────┘   │
│                                     │
│ Results Pages: [1] ↕               │
│ 1 - 5 pages (more = more jobs)     │
│                                     │
│ ┌──────────────┐  ┌──────────────┐ │
│ │ Submit Search│  │    Cancel    │ │
│ └──────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
```

---

## ADVANCED MODE (New - Business Discovery)

```
┌────────────────────────────────────────────────────────┐
│ BUSINESS DISCOVERY SEARCH                              │
├────────────────────────────────────────────────────────┤
│                                                         │
│ SEARCH CRITERIA                                        │
│ ──────────────────────────────────────────────────────│
│                                                         │
│ Keywords (one per line) *                              │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Realtor                                             │ │
│ │ House sellers                                       │ │
│ │ Real estate agent                                   │ │
│ │ Real estate management                              │ │
│ │ Property manager                                    │ │
│ └────────────────────────────────────────────────────┘ │
│ Add up to 10 keywords (currently: 5)                 │ │
│                                                         │
│ Search Patterns (optional)                             │
│ ┌────────────────────────────────────────────────────┐ │
│ │ @earthlink.net                                      │ │
│ │ @verizon.com                                        │ │
│ └────────────────────────────────────────────────────┘ │
│ Filter results to specific email domains              │ │
│ Example: @domain.com (case insensitive)             │ │
│                                                         │
│ Location (optional)                                    │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Florida                                             │ │
│ └────────────────────────────────────────────────────┘ │
│ Include location context in search                     │ │
│                                                         │
│ ────────────────────────────────────────────────────── │
│ CONFIGURATION                                          │
│ ──────────────────────────────────────────────────────│
│                                                         │
│ Delay Between Queries (ms)                             │
│ ┌─────┐                                               │
│ │ 200 │ milliseconds                                   │
│ └─────┘                                               │
│ Helps avoid rate limiting                             │ │
│                                                         │
│ ☐ Deep Search                                          │
│   Use multiple search techniques to find more results  │
│                                                         │
│ ────────────────────────────────────────────────────── │
│ SUMMARY                                                │
│ ──────────────────────────────────────────────────────│
│                                                         │
│ Estimated Jobs: 175 (5 keywords × 35 avg URLs)     │ │
│ Max Query Delay: ~87.5 seconds                        │ │
│                                                         │
│ ┌──────────────────┐  ┌──────────────────────────┐  │ │
│ │ ↓ Download CSV   │  │ ℹ Help & Examples        │  │ │
│ └──────────────────┘  └──────────────────────────┘  │ │
│                                                         │
│ ┌────────────────────────────────────────────────────┐ │
│ │  ▶ START SEARCH                                    │ │
│ └────────────────────────────────────────────────────┘ │
│                                                         │
└────────────────────────────────────────────────────────┘
```

---

## Form Fields Description

### Keywords Input
- **Type**: Textarea
- **Placeholder**: "Realtor\nHouse sellers\nReal estate agent"
- **Max**: 10 keywords
- **Format**: One per line
- **Validation**: Non-empty, no special characters
- **Character limit**: 50 per keyword
- **Display**: Show count "5 / 10"

### Search Patterns Input
- **Type**: Textarea
- **Placeholder**: "@domain.com\n@domain2.org"
- **Max**: 10 patterns
- **Format**: One per line, starting with @
- **Validation**: Must start with @, valid email domain format
- **Optional**: Yes (user can leave blank)
- **Display**: Show count "2 / 10"

### Location Input
- **Type**: Text input
- **Placeholder**: "Florida"
- **Max length**: 50 characters
- **Optional**: Yes
- **Examples**: "New York", "San Francisco Bay Area", "Los Angeles County"

### Delay Input
- **Type**: Number input
- **Min**: 0 (no delay)
- **Max**: 5000 (5 seconds)
- **Default**: 200 (milliseconds)
- **Optional**: No (has default)
- **Tooltip**: "Milliseconds between Google API queries"

### Deep Search Toggle
- **Type**: Checkbox
- **Label**: "Deep Search"
- **Default**: Unchecked (false)
- **Description**: "Use multiple search techniques to find more results"
- **Optional**: Yes

---

## Form State Management

```typescript
interface AdvancedSearchState {
  mode: 'simple' | 'advanced';
  
  // Simple mode
  simpleQuery: string;
  simplePages: number;
  
  // Advanced mode
  keywords: string[];
  patterns: string[];
  location: string;
  delayMs: number;
  deepSearch: boolean;
  
  // UI state
  isSubmitting: boolean;
  error: string | null;
  success: string | null;
  jobPreview: {
    estimatedJobs: number;
    estimatedDuration: number;
  };
}
```

---

## Validation Rules

### Keywords
- ✓ At least 1 keyword required
- ✓ Max 10 keywords
- ✓ No special characters (allow alphanumeric, space, dash)
- ✓ No duplicates
- ✓ Trim whitespace

### Patterns
- ✓ Optional (can be empty)
- ✓ Must start with '@'
- ✓ Valid domain format after '@' (DNS rules)
- ✓ No duplicates
- ✓ Max 10 patterns

### Location
- ✓ Optional
- ✓ Max 50 characters
- ✓ Alphanumeric + space, comma allowed

### Delay
- ✓ 0 - 5000 milliseconds
- ✓ Must be integer
- ✓ Default: 200

---

## Button States

### Before Submit
```
[ ↓ Download CSV ] [ ℹ Help ] [ ▶ START SEARCH ]
```
- Download: Disabled (or show template)
- Help: Show modal with examples
- Start: Enabled (when validation passes)

### During Submit
```
[ ↓ Download CSV ] [ ℹ Help ] [ ⟳ Searching... ]
```
- Download: Disabled
- Help: Disabled
- Start: Disabled, shows loading indicator

### After Submit
```
✓ Search created! (Green alert)
[Show Recent Searches below]
```

---

## Error States

### Validation Errors
```
⚠ Please add at least 1 keyword
- Keywords: required
- Patterns: optional
- Location: optional (adds context)
```

### Pattern Format Error
```
⚠ Invalid pattern format
Pattern "@invalidomain" must be: @domain.com
Examples: @gmail.com, @company.org, @example.net
```

### API Errors
```
✗ Search failed: Google API quota exceeded
Please try again later or contact support.
```

---

## Job Preview Section

Shows before submission:

```
Estimated Statistics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Keywords: 5
Avg URLs per keyword: 35
Pattern filter applied: 2 patterns
Estimated jobs: 175 (5 × 35)
Estimated time: ~87.5 seconds (with 200ms delay)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ Warning: This will create ~175 extraction jobs
This may take several minutes to complete.
```

---

## Recent Searches Display

```
┌──────────────────────────────────────┐
│ Recent Searches                      │
├──────────────────────────────────────┤
│                                      │
│ [Realtor + @earthlink.net] Florida   │
│ 175 jobs • Advanced • 2 hours ago    │
│                                      │
│ [Real estate agent + @verizon]       │
│ 98 jobs • Advanced • 1 day ago       │
│                                      │
│ tech startups san francisco          │
│ 42 jobs • Simple • 3 days ago        │
│                                      │
└──────────────────────────────────────┘
```

---

## Component Structure

```
SearchPage (page.tsx)
├── Tabs/Toggle
│   ├── SimpleSearchTab
│   │   ├── QueryInput
│   │   ├── PagesInput
│   │   └── SubmitButton
│   └── AdvancedSearchTab
│       ├── FormSection
│       │   ├── KeywordsInput
│       │   ├── PatternsInput
│       │   ├── LocationInput
│       │   └── ConfigSection
│       │       ├── DelayInput
│       │       └── DeepSearchToggle
│       ├── JobPreview
│       ├── Actions
│       │   ├── DownloadButton
│       │   ├── HelpButton
│       │   └── StartButton
│       └── RecentSearches
├── AlertMessages
│   ├── ErrorAlert
│   ├── SuccessAlert
│   └── WarningAlert
└── LoadingIndicator
```

---

## UX Flow

### User Journey

1. User lands on search page (defaults to Simple)
2. User switches to "Advanced" mode
3. User enters keywords (required)
4. User optionally adds patterns and location
5. Form shows job preview
6. User reviews and clicks "START SEARCH"
7. Form shows submission progress
8. Results appear in "Recent Searches"
9. Jobs appear in /dashboard/jobs

---

## Responsive Design

### Desktop (>1024px)
- Full width form
- Two-column layout for configuration section
- All fields visible at once

### Tablet (768px - 1024px)
- Single column, slightly reduced width
- Collapsible configuration section
- Stacked buttons

### Mobile (<768px)
- Full width, small margins
- Single column, stacked inputs
- Full-width buttons
- Collapsible configuration section
- Horizontal scroll for summary stats (if needed)

---

## Styling Notes

- **Theme**: Consistent with dashboard (Card, Button from shadcn/ui)
- **Colors**: Use existing design tokens (primary, secondary, error, success)
- **Spacing**: Tailwind gap classes
- **Typography**: Clear hierarchy, use existing font scales
- **Icons**: Lucide React (already used in dashboard)

---

## Reference to Screenshot

The provided reference shows:
- Keywords in dropdown list (implement as textarea instead)
- Patterns input with examples
- Location field
- Configuration options
- Deep search toggle
- Start button (primary action)
- Download and Help buttons (secondary actions)

We'll adapt this design while staying within the existing design system.
