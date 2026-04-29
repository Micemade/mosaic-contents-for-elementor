---
name: headlessui-react
description: Use when building with HeadlessUI for React — unstyled, accessible UI components. Covers compound component API, render props, as/asChild prop, Dialog, Menu, Listbox, Combobox, Switch, Disclosure, Popover, RadioGroup, Tabs, Transitions, Floating UI positioning, focus management, keyboard navigation, ARIA patterns, and playground examples via MCP tools.
---

# HeadlessUI React

## 1. Overview

HeadlessUI provides **completely unstyled, fully accessible UI components** for React. Components handle all the complex accessibility and interaction logic — you provide all the styling. 38 playground examples are available via MCP.

All HeadlessUI React examples are available through the `frontend-components` MCP server under the `headlessui-react` framework.

## 2. Installation

```bash
npm install @headlessui/react
```

Optional (for icons):
```bash
npm install @heroicons/react
```

## 3. MCP Workflow

### 3.1 Browse Available Examples

```
list_components(framework: "headlessui-react")
```

Components: combobox, dialog, disclosure, listbox, menu, popover, radio-group, switch, tabs, transitions, combinations, suspense.

### 3.2 Get Example Code

```
get_component(framework: "headlessui-react", category: "components", component_type: "dialog", variant: "dialog")
get_component(framework: "headlessui-react", category: "components", component_type: "menu", variant: "menu")
get_component(framework: "headlessui-react", category: "components", component_type: "combobox", variant: "combobox")
```

### 3.3 Search

```
search_components(query: "listbox", framework: "headlessui-react")
search_components(query: "transition", framework: "headlessui-react")
```

## 4. Core API Patterns

### 4.1 Compound Components

HeadlessUI uses compound component patterns. Parent manages state, children render UI:

```jsx
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";

function MyMenu() {
  return (
    <Menu>
      <MenuButton className="...">Options</MenuButton>
      <MenuItems className="...">
        <MenuItem>
          <a className="..." href="/edit">Edit</a>
        </MenuItem>
        <MenuItem>
          <a className="..." href="/delete">Delete</a>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
```

### 4.2 The `as` Prop

Change the rendered element for any component:

```jsx
<MenuButton as="div" className="...">Options</MenuButton>
<MenuItem as="button" className="...">Edit</MenuItem>
<DialogPanel as="form" className="...">...</DialogPanel>
```

### 4.3 Render Props / Data Attributes

HeadlessUI exposes component state through data attributes for styling:

```jsx
<MenuItem>
  <a
    className="data-[focus]:bg-blue-100 data-[disabled]:opacity-50"
    href="/edit"
  >
    Edit
  </a>
</MenuItem>

<Switch
  checked={enabled}
  onChange={setEnabled}
  className="data-[checked]:bg-blue-600 bg-gray-200"
/>
```

Key data attributes:
| Attribute | Components | Meaning |
|-----------|-----------|---------|
| `data-[focus]` | MenuItem, ListboxOption, ComboboxOption | Item has focus |
| `data-[active]` | MenuItem, ListboxOption | Item is active |
| `data-[selected]` | ListboxOption, ComboboxOption, Tab | Item is selected |
| `data-[checked]` | Switch, RadioGroupOption | Item is checked |
| `data-[open]` | Disclosure, Popover, Menu, Dialog | Panel is open |
| `data-[disabled]` | Most components | Item is disabled |
| `data-[closed]` | Transition targets | Element is closed/hidden |

## 5. Component Reference

### 5.1 Dialog (Modal)

```jsx
import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from "@headlessui/react";

function MyDialog({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="max-w-lg rounded bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-bold">Title</DialogTitle>
          <p>Content here</p>
          <button onClick={onClose}>Close</button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
```

Key features:
- Focus trapping — focus stays within dialog
- Scroll locking — page scroll disabled when open
- Click outside to close (default)
- Escape key to close (default)

### 5.2 Menu (Dropdown)

```jsx
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";

<Menu>
  <MenuButton className="rounded bg-gray-100 px-3 py-2">Options</MenuButton>
  <MenuItems
    anchor="bottom start"
    className="rounded bg-white shadow-lg ring-1 ring-black/5"
  >
    <MenuItem>
      <button className="block w-full px-4 py-2 text-left data-[focus]:bg-gray-100">
        Edit
      </button>
    </MenuItem>
    <MenuItem>
      <button className="block w-full px-4 py-2 text-left data-[focus]:bg-gray-100">
        Delete
      </button>
    </MenuItem>
  </MenuItems>
</Menu>
```

### 5.3 Listbox (Select)

```jsx
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from "@headlessui/react";

function MySelect({ value, onChange, options }) {
  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton className="...">{value.name}</ListboxButton>
      <ListboxOptions anchor="bottom" className="...">
        {options.map((option) => (
          <ListboxOption
            key={option.id}
            value={option}
            className="data-[focus]:bg-blue-100 cursor-pointer px-4 py-2"
          >
            {option.name}
          </ListboxOption>
        ))}
      </ListboxOptions>
    </Listbox>
  );
}
```

### 5.4 Combobox (Autocomplete)

```jsx
import { Combobox, ComboboxInput, ComboboxOptions, ComboboxOption, ComboboxButton } from "@headlessui/react";

function MyCombobox({ value, onChange, options }) {
  const [query, setQuery] = useState("");
  const filtered = query === ""
    ? options
    : options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Combobox value={value} onChange={onChange} onClose={() => setQuery("")}>
      <div className="relative">
        <ComboboxInput
          className="..."
          displayValue={(o) => o?.name}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ComboboxButton className="absolute inset-y-0 right-0 px-2.5">▼</ComboboxButton>
      </div>
      <ComboboxOptions anchor="bottom" className="...">
        {filtered.map((option) => (
          <ComboboxOption key={option.id} value={option} className="data-[focus]:bg-blue-100 px-4 py-2">
            {option.name}
          </ComboboxOption>
        ))}
      </ComboboxOptions>
    </Combobox>
  );
}
```

### 5.5 Switch (Toggle)

```jsx
import { Switch } from "@headlessui/react";

<Switch
  checked={enabled}
  onChange={setEnabled}
  className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-gray-200 transition-colors data-[checked]:bg-blue-600"
>
  <span className="pointer-events-none inline-block size-5 translate-x-0.5 rounded-full bg-white shadow ring-0 transition-transform group-data-[checked]:translate-x-5" />
</Switch>
```

### 5.6 Disclosure (Accordion)

```jsx
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";

<Disclosure>
  <DisclosureButton className="flex w-full justify-between rounded-lg bg-gray-100 px-4 py-2">
    Section Title
  </DisclosureButton>
  <DisclosurePanel className="px-4 py-2 text-gray-500">
    Content here
  </DisclosurePanel>
</Disclosure>
```

### 5.7 Popover

```jsx
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";

<Popover className="relative">
  <PopoverButton className="...">Info</PopoverButton>
  <PopoverPanel anchor="bottom" className="...">
    Popover content
  </PopoverPanel>
</Popover>
```

### 5.8 RadioGroup

```jsx
import { RadioGroup, Radio, Label, Description } from "@headlessui/react";

<RadioGroup value={selected} onChange={setSelected}>
  {options.map((option) => (
    <Radio
      key={option.id}
      value={option}
      className="group relative flex cursor-pointer rounded-lg border px-5 py-4 data-[checked]:bg-blue-50 data-[checked]:border-blue-500"
    >
      <Label className="font-medium">{option.name}</Label>
      <Description className="text-gray-500">{option.desc}</Description>
    </Radio>
  ))}
</RadioGroup>
```

### 5.9 Tabs

```jsx
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@headlessui/react";

<TabGroup>
  <TabList className="flex gap-4">
    <Tab className="rounded-full px-3 py-1 data-[selected]:bg-blue-100 data-[selected]:text-blue-700">
      Tab 1
    </Tab>
    <Tab className="rounded-full px-3 py-1 data-[selected]:bg-blue-100 data-[selected]:text-blue-700">
      Tab 2
    </Tab>
  </TabList>
  <TabPanels className="mt-3">
    <TabPanel>Panel 1</TabPanel>
    <TabPanel>Panel 2</TabPanel>
  </TabPanels>
</TabGroup>
```

## 6. Transitions

HeadlessUI includes a built-in `Transition` component. Use Tailwind classes for animations:

```jsx
import { Transition } from "@headlessui/react";

<Transition
  show={isOpen}
  enter="transition-opacity duration-150"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="transition-opacity duration-150"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
>
  <div>Animated content</div>
</Transition>
```

Many components support built-in transition via `transition` prop:

```jsx
<MenuItems
  transition
  className="transition duration-100 ease-in data-[closed]:scale-95 data-[closed]:opacity-0"
>
```

## 7. Floating UI (Positioning)

HeadlessUI uses Floating UI internally for positioning dropdown panels. Control with the `anchor` prop:

```jsx
<MenuItems anchor="bottom start">  {/* Below, left-aligned */}
<MenuItems anchor="bottom end">    {/* Below, right-aligned */}
<MenuItems anchor="top start">     {/* Above, left-aligned */}
<ListboxOptions anchor="bottom">   {/* Below, centered */}
```

Anchor values: `top`, `right`, `bottom`, `left` with optional `start`/`end` alignment.

Add gap with `anchor={{ to: 'bottom', gap: 4 }}`.

## 8. Accessibility Features

HeadlessUI handles these automatically:
- ARIA attributes (`role`, `aria-expanded`, `aria-haspopup`, `aria-labelledby`, etc.)
- Keyboard navigation (arrow keys, Enter, Space, Escape, Home, End)
- Focus management (trapping in dialogs, return focus on close)
- Screen reader announcements
- Click-outside-to-close for menus, popovers, dialogs

## 9. Common Patterns

### 9.1 Controlled vs Uncontrolled

```jsx
// Controlled — you manage state
const [selected, setSelected] = useState(options[0]);
<Listbox value={selected} onChange={setSelected}>

// Uncontrolled — HeadlessUI manages state
<Listbox defaultValue={options[0]} onChange={(val) => console.log(val)}>
```

### 9.2 Form Integration

HeadlessUI components work with native forms when given a `name`:

```jsx
<Listbox name="country" value={selected} onChange={setSelected}>
  {/* renders a hidden input with the selected value */}
</Listbox>
```

### 9.3 Disabled Items

```jsx
<MenuItem disabled>
  <button className="data-[disabled]:opacity-50" disabled>
    Can't click
  </button>
</MenuItem>
```

## 10. Workflow Summary

| Step | Action |
|------|--------|
| 1. Pick component | Dialog, Menu, Listbox, Combobox, Switch, etc. |
| 2. Fetch example | `get_component(framework: "headlessui-react", ...)` |
| 3. Import | `import { Component } from "@headlessui/react"` |
| 4. Style with Tailwind | Use className + data attributes for states |
| 5. Add transitions | Use `transition` prop or `Transition` component |
| 6. Position | Use `anchor` prop for dropdowns/popovers |
