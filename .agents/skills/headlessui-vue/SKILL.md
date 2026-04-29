---
name: headlessui-vue
description: Use when building with HeadlessUI for Vue — unstyled, accessible UI components. Covers compound component API, v-slot props, as prop, Dialog, Menu, Listbox, Combobox, Switch, Disclosure, Popover, RadioGroup, Tabs, TransitionRoot/TransitionChild, Floating UI positioning, focus management, keyboard navigation, ARIA patterns, and playground examples via MCP tools.
---

# HeadlessUI Vue

## 1. Overview

HeadlessUI provides **completely unstyled, fully accessible UI components** for Vue 3. Components handle all the complex accessibility and interaction logic — you provide all the styling. 30 playground examples are available via MCP.

All HeadlessUI Vue examples are available through the `frontend-components` MCP server under the `headlessui-vue` framework.

## 2. Installation

```bash
npm install @headlessui/vue
```

Optional (for icons):
```bash
npm install @heroicons/vue
```

## 3. MCP Workflow

### 3.1 Browse Available Examples

```
list_components(framework: "headlessui-vue")
```

Components: combobox, dialog, disclosure, focus-trap, listbox, menu, popover, radio-group, switch, tabs, combinations.

### 3.2 Get Example Code

```
get_component(framework: "headlessui-vue", category: "components", component_type: "dialog", variant: "Dialog")
get_component(framework: "headlessui-vue", category: "components", component_type: "menu", variant: "Menu")
```

### 3.3 Search

```
search_components(query: "listbox", framework: "headlessui-vue")
search_components(query: "disclosure", framework: "headlessui-vue")
```

## 4. Core API Patterns

### 4.1 Compound Components

HeadlessUI Vue uses compound component patterns with slots:

```vue
<template>
  <Menu>
    <MenuButton class="...">Options</MenuButton>
    <MenuItems class="...">
      <MenuItem v-slot="{ active }">
        <a :class="{ 'bg-gray-100': active }" href="/edit">Edit</a>
      </MenuItem>
      <MenuItem v-slot="{ active }">
        <a :class="{ 'bg-gray-100': active }" href="/delete">Delete</a>
      </MenuItem>
    </MenuItems>
  </Menu>
</template>

<script setup>
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
</script>
```

### 4.2 The `as` Prop

Change the rendered element:

```vue
<MenuButton as="div" class="...">Options</MenuButton>
<MenuItem as="button" class="...">Edit</MenuItem>
<DialogPanel as="form" class="..." @submit.prevent="handleSubmit">
```

### 4.3 Slot Props

HeadlessUI Vue exposes state through slot props for v-slot binding:

```vue
<MenuItem v-slot="{ active, disabled }">
  <a :class="{ 'bg-blue-100': active, 'opacity-50': disabled }">
    Edit
  </a>
</MenuItem>

<Switch
  v-model="enabled"
  :class="enabled ? 'bg-blue-600' : 'bg-gray-200'"
  class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full"
>
  <span :class="enabled ? 'translate-x-5' : 'translate-x-0.5'" class="..." />
</Switch>
```

### 4.4 Data Attributes

Like the React version, state is also exposed via data attributes:

```vue
<MenuItem>
  <a class="data-[focus]:bg-blue-100 data-[disabled]:opacity-50" href="/edit">
    Edit
  </a>
</MenuItem>
```

Key slot props and data attributes:

| Slot Prop | Data Attribute | Components |
|-----------|---------------|-----------|
| `active` | `data-[focus]` | MenuItem, ListboxOption, ComboboxOption |
| `selected` | `data-[selected]` | ListboxOption, ComboboxOption, Tab |
| `checked` | `data-[checked]` | Switch, RadioGroupOption |
| `open` | `data-[open]` | Disclosure, Popover, Menu |
| `disabled` | `data-[disabled]` | Most components |

## 5. Component Reference

### 5.1 Dialog (Modal)

```vue
<template>
  <Dialog :open="isOpen" @close="isOpen = false" class="relative z-50">
    <div class="fixed inset-0 bg-black/30" aria-hidden="true" />
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel class="max-w-lg rounded bg-white p-6 shadow-xl">
        <DialogTitle class="text-lg font-bold">Title</DialogTitle>
        <p>Content here</p>
        <button @click="isOpen = false">Close</button>
      </DialogPanel>
    </div>
  </Dialog>
</template>

<script setup>
import { ref } from "vue";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/vue";

const isOpen = ref(false);
</script>
```

### 5.2 Listbox (Select)

```vue
<template>
  <Listbox v-model="selected">
    <ListboxButton class="...">{{ selected.name }}</ListboxButton>
    <ListboxOptions anchor="bottom" class="...">
      <ListboxOption
        v-for="option in options"
        :key="option.id"
        :value="option"
        v-slot="{ active, selected }"
        class="cursor-pointer px-4 py-2"
        :class="{ 'bg-blue-100': active }"
      >
        <span :class="{ 'font-bold': selected }">{{ option.name }}</span>
      </ListboxOption>
    </ListboxOptions>
  </Listbox>
</template>

<script setup>
import { ref } from "vue";
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from "@headlessui/vue";

const options = [
  { id: 1, name: "Option A" },
  { id: 2, name: "Option B" },
];
const selected = ref(options[0]);
</script>
```

### 5.3 Combobox (Autocomplete)

```vue
<template>
  <Combobox v-model="selected" @update:modelValue="query = ''">
    <ComboboxInput
      class="..."
      :displayValue="(o) => o?.name"
      @change="query = $event.target.value"
    />
    <ComboboxButton class="...">▼</ComboboxButton>
    <ComboboxOptions anchor="bottom" class="...">
      <ComboboxOption
        v-for="option in filtered"
        :key="option.id"
        :value="option"
        v-slot="{ active }"
        :class="{ 'bg-blue-100': active }"
        class="px-4 py-2"
      >
        {{ option.name }}
      </ComboboxOption>
    </ComboboxOptions>
  </Combobox>
</template>

<script setup>
import { ref, computed } from "vue";
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from "@headlessui/vue";

const query = ref("");
const selected = ref(null);
const options = [/* ... */];
const filtered = computed(() =>
  query.value === ""
    ? options
    : options.filter((o) => o.name.toLowerCase().includes(query.value.toLowerCase()))
);
</script>
```

### 5.4 Switch (Toggle)

```vue
<template>
  <Switch
    v-model="enabled"
    :class="enabled ? 'bg-blue-600' : 'bg-gray-200'"
    class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
  >
    <span
      :class="enabled ? 'translate-x-5' : 'translate-x-0.5'"
      class="pointer-events-none inline-block size-5 rounded-full bg-white shadow transition-transform"
    />
  </Switch>
</template>

<script setup>
import { ref } from "vue";
import { Switch } from "@headlessui/vue";

const enabled = ref(false);
</script>
```

### 5.5 Disclosure (Accordion)

```vue
<template>
  <Disclosure v-slot="{ open }">
    <DisclosureButton class="flex w-full justify-between rounded-lg bg-gray-100 px-4 py-2">
      Section Title
      <ChevronUpIcon :class="{ 'rotate-180': !open }" class="size-5 transition-transform" />
    </DisclosureButton>
    <DisclosurePanel class="px-4 py-2 text-gray-500">
      Content here
    </DisclosurePanel>
  </Disclosure>
</template>

<script setup>
import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/vue";
</script>
```

### 5.6 Popover

```vue
<template>
  <Popover class="relative">
    <PopoverButton class="...">Info</PopoverButton>
    <PopoverPanel anchor="bottom" class="...">
      Popover content
    </PopoverPanel>
  </Popover>
</template>

<script setup>
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/vue";
</script>
```

### 5.7 RadioGroup

```vue
<template>
  <RadioGroup v-model="selected">
    <RadioGroupOption
      v-for="option in options"
      :key="option.id"
      :value="option"
      v-slot="{ checked }"
      :class="{ 'bg-blue-50 border-blue-500': checked }"
      class="cursor-pointer rounded-lg border px-5 py-4"
    >
      <RadioGroupLabel class="font-medium">{{ option.name }}</RadioGroupLabel>
      <RadioGroupDescription class="text-gray-500">{{ option.desc }}</RadioGroupDescription>
    </RadioGroupOption>
  </RadioGroup>
</template>

<script setup>
import { ref } from "vue";
import { RadioGroup, RadioGroupOption, RadioGroupLabel, RadioGroupDescription } from "@headlessui/vue";

const selected = ref(null);
const options = [/* ... */];
</script>
```

### 5.8 Tabs

```vue
<template>
  <TabGroup>
    <TabList class="flex gap-4">
      <Tab
        v-for="tab in tabs"
        :key="tab"
        v-slot="{ selected }"
        :class="{ 'bg-blue-100 text-blue-700': selected }"
        class="rounded-full px-3 py-1"
      >
        {{ tab }}
      </Tab>
    </TabList>
    <TabPanels class="mt-3">
      <TabPanel v-for="tab in tabs" :key="tab">
        {{ tab }} content
      </TabPanel>
    </TabPanels>
  </TabGroup>
</template>

<script setup>
import { TabGroup, TabList, Tab, TabPanels, TabPanel } from "@headlessui/vue";

const tabs = ["Tab 1", "Tab 2", "Tab 3"];
</script>
```

## 6. Transitions

### 6.1 TransitionRoot and TransitionChild

```vue
<template>
  <TransitionRoot :show="isOpen" as="template">
    <Dialog @close="isOpen = false">
      <TransitionChild
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-black/25" />
      </TransitionChild>

      <TransitionChild
        enter="ease-out duration-300"
        enter-from="opacity-0 scale-95"
        enter-to="opacity-100 scale-100"
        leave="ease-in duration-200"
        leave-from="opacity-100 scale-100"
        leave-to="opacity-0 scale-95"
      >
        <DialogPanel class="...">Content</DialogPanel>
      </TransitionChild>
    </Dialog>
  </TransitionRoot>
</template>
```

### 6.2 Built-in Transition

Components that support transitions can use the `transition` prop with data attributes:

```vue
<MenuItems
  transition
  class="transition duration-100 ease-in data-[closed]:scale-95 data-[closed]:opacity-0"
>
```

## 7. Floating UI (Positioning)

Control dropdown positioning with the `anchor` prop:

```vue
<MenuItems anchor="bottom start">    <!-- Below, left-aligned -->
<MenuItems anchor="bottom end">      <!-- Below, right-aligned -->
<ListboxOptions anchor="top start">  <!-- Above, left-aligned -->
```

Add offset: `:anchor="{ to: 'bottom', gap: 4 }"`.

## 8. Vue-Specific Patterns

### 8.1 v-model Support

Components with state support `v-model`:

```vue
<Switch v-model="enabled" />
<Listbox v-model="selected" />
<Combobox v-model="selected" />
<RadioGroup v-model="plan" />
<TabGroup :selectedIndex="index" @change="index = $event" />
```

### 8.2 Form Integration

```vue
<Listbox v-model="selected" name="country">
  <!-- renders hidden input with selected value -->
</Listbox>
```

### 8.3 Multiple Selection

```vue
<Listbox v-model="selected" multiple>
  <!-- selected is an array -->
</Listbox>
```

## 9. Accessibility Features

HeadlessUI handles automatically:
- ARIA attributes (`role`, `aria-expanded`, `aria-haspopup`, `aria-labelledby`)
- Keyboard navigation (arrow keys, Enter, Space, Escape, Home, End)
- Focus management (trapping in dialogs, return focus on close)
- Screen reader announcements
- Click-outside-to-close

## 10. Workflow Summary

| Step | Action |
|------|--------|
| 1. Pick component | Dialog, Menu, Listbox, Combobox, Switch, etc. |
| 2. Fetch example | `get_component(framework: "headlessui-vue", ...)` |
| 3. Import | `import { Component } from "@headlessui/vue"` |
| 4. Style with Tailwind | Use class binding + slot props or data attributes |
| 5. Add transitions | Use TransitionRoot/TransitionChild or `transition` prop |
| 6. Position | Use `anchor` prop for dropdowns/popovers |
| 7. v-model | Bind state with v-model for controlled components |
