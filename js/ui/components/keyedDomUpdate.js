import { getHomeFocusIdentity } from "../screens/home/homeFocusPolicy.js";

// Compare generated markup, rather than the live DOM: focus, image hydration,
// expansion and trailer playback all add state that a data refresh must retain.
const sourceByNode = new WeakMap();
const mountedShells = new WeakMap();

export function hasMountedKeyedDom(container, shellSelector = ".home-shell") {
  const shell = mountedShells.get(container);
  return Boolean(shell && shell === container.querySelector(shellSelector));
}

function children(node) {
  return Array.from(node.childNodes).filter(
    (child) => child.nodeType !== 3 || child.textContent.trim()
  );
}

function key(node) {
  if (node.nodeType !== 1) return `node:${node.nodeType}`;
  const identity = getHomeFocusIdentity(node);
  if (identity && node.classList.contains("home-content-card")) {
    return `card:${JSON.stringify(identity)}`;
  }
  if (node.dataset.streamKey != null) return `stream:${node.dataset.streamKey}`;
  if (node.dataset.addon != null) return `addon:${node.dataset.addon}`;
  if (node.id) return `id:${node.id}`;
  if (node.dataset.rowKey) return `row:${node.dataset.rowKey}`;
  if (node.dataset.trackRowKey) return `track:${node.dataset.trackRowKey}`;
  if (node.dataset.action && node.classList.contains("focusable"))
    return `action:${node.dataset.action}`;
  return `${node.tagName}:${node.classList.item(0) || ""}`;
}

function signature(node) {
  return node.nodeType === 1 ? node.outerHTML : node.textContent;
}

function snapshot(source, withMarkup = true) {
  // Shallow nodes cannot retain entire detached markup trees through parentNode.
  // A null markup only disables updateNode's unchanged-markup shortcut.
  return { node: source.cloneNode(false), markup: withMarkup ? signature(source) : null };
}

function remember(node, source, withMarkup = true) {
  sourceByNode.set(node, snapshot(source, withMarkup));
  const liveChildren = children(node);
  children(source).forEach((child, index) => remember(liveChildren[index], child, withMarkup));
}

export function registerHomeDomNodes(nodes) {
  nodes.forEach((node) => remember(node, node));
}

function updateAttributes(node, previous, next) {
  const names = new Set(
    [...Array.from(previous.attributes), ...Array.from(next.attributes)].map((attr) => attr.name)
  );
  names.forEach((name) => {
    const oldValue = previous.getAttribute(name);
    const newValue = next.getAttribute(name);
    if (oldValue === newValue) return;
    if (name === "class") {
      Array.from(previous.classList).forEach((token) => {
        if (
          node.classList.contains("home-content-card") &&
          ["focused", "is-expanded", "is-trailer-active", "is-expanded-backdrop-ready"].includes(
            token
          )
        )
          return;
        if (!next.classList.contains(token)) node.classList.remove(token);
      });
      Array.from(next.classList).forEach((token) => {
        if (
          node.classList.contains("home-content-card") &&
          ["focused", "is-expanded", "is-trailer-active", "is-expanded-backdrop-ready"].includes(
            token
          )
        )
          return;
        if (!previous.classList.contains(token)) node.classList.add(token);
      });
    } else if (name === "style") {
      const properties = new Set([...Array.from(previous.style), ...Array.from(next.style)]);
      properties.forEach((property) => {
        if (previous.style.getPropertyValue(property) === next.style.getPropertyValue(property))
          return;
        const value = next.style.getPropertyValue(property);
        if (value)
          node.style.setProperty(property, value, next.style.getPropertyPriority(property));
        else node.style.removeProperty(property);
      });
    } else if (newValue === null) {
      node.removeAttribute(name);
    } else {
      node.setAttribute(name, newValue);
    }
  });
  // A hydrated deferred image must not keep showing its old URL after its
  // source changes. The existing Home hydration pass loads the new data-src.
  if (
    node.tagName === "IMG" &&
    previous.getAttribute("data-src") !== next.getAttribute("data-src") &&
    !next.hasAttribute("src")
  ) {
    node.removeAttribute("src");
  }
}

function updateNode(node, source, protectedNode) {
  const previous = sourceByNode.get(node);
  if (previous.markup !== null && previous.markup === signature(source)) return;
  if (node.nodeType === 1) {
    updateAttributes(node, previous.node, source);
    updateChildren(node, source, protectedNode);
  } else {
    node.textContent = source.textContent;
  }
  sourceByNode.set(node, snapshot(source));
}

function updateChildren(parent, source, protectedNode) {
  const available = new Map();
  children(parent).forEach((node) => {
    // textContent/truncation replaces Text nodes. They still belong to the
    // generated copy; treating them as runtime media duplicates text on refresh.
    if (!sourceByNode.has(node) && node.nodeType === 3) remember(node, node);
    const previous = sourceByNode.get(node);
    if (!previous) return; // Runtime-owned trailer/GIF/transition nodes.
    const nodeKey = key(previous.node);
    if (!available.has(nodeKey)) available.set(nodeKey, []);
    available.get(nodeKey).push(node);
  });
  const desired = children(source).map((child) => {
    const candidates = available.get(key(child));
    const existing = candidates?.find(
      (node) => node.nodeType === child.nodeType && node.nodeName === child.nodeName
    );
    if (existing) {
      candidates.splice(candidates.indexOf(existing), 1);
      updateNode(existing, child, protectedNode);
      return existing;
    }
    const inserted = child.cloneNode(true);
    remember(inserted, child);
    return inserted;
  });
  available.forEach((nodes) => nodes.forEach((node) => node.remove()));

  const desiredSet = new Set(desired);
  const nextManagedSibling = (node) => {
    let sibling = node.nextSibling;
    while (sibling && !desiredSet.has(sibling)) sibling = sibling.nextSibling;
    return sibling;
  };

  // insertBefore() detaches an existing node and can blur its descendants.
  // Keep the branch containing focus anchored and reorder its siblings around it.
  const anchorIndex = desired.findIndex(
    (node) => node === protectedNode || node.contains(protectedNode)
  );
  let before = anchorIndex >= 0 ? desired[anchorIndex] : null;
  for (let index = (anchorIndex >= 0 ? anchorIndex : desired.length) - 1; index >= 0; index -= 1) {
    const node = desired[index];
    if (node.parentNode !== parent || nextManagedSibling(node) !== before)
      parent.insertBefore(node, before);
    before = node;
  }
  if (anchorIndex >= 0) {
    let after = desired[anchorIndex];
    for (let index = anchorIndex + 1; index < desired.length; index += 1) {
      const node = desired[index];
      if (node.parentNode !== parent || nextManagedSibling(after) !== node)
        parent.insertBefore(node, after.nextSibling);
      after = node;
    }
  }
}

function parseElement(document, markup) {
  const source = document.createElement("div");
  source.innerHTML = markup;
  return source.firstElementChild;
}

/**
 * Call after changing an element's children outside updateKeyedDom. Its stored
 * markup, and that of its registered ancestors, no longer describes the DOM, so
 * a later update must not take the unchanged-markup shortcut on them.
 */
export function invalidateKeyedMarkup(element) {
  for (let node = element; node && sourceByNode.has(node); node = node.parentNode) {
    sourceByNode.get(node).markup = null;
  }
}

/** Change a keyed attribute on a registered node and its stored snapshot alike. */
export function setKeyedAttribute(node, name, value) {
  node.setAttribute(name, value);
  sourceByNode.get(node)?.node.setAttribute(name, value);
}

/** Re-render one registered element from its own markup; only that markup is parsed. */
export function patchKeyedNode(node, markup, { focusedNode = null } = {}) {
  const next = sourceByNode.has(node) ? parseElement(node.ownerDocument, markup) : null;
  if (!next) return false;
  updateNode(node, next, focusedNode);
  invalidateKeyedMarkup(node.parentNode);
  return true;
}

/**
 * Parse one element and register it so later keyed updates can reuse it. Its
 * subtree is registered without serialized markup: serializing every new node
 * costs more than the one full diff a later change to it would need.
 */
export function createKeyedNode(document, markup) {
  const node = parseElement(document, markup);
  if (node) remember(node, node, false);
  return node;
}

export function updateKeyedDom(container, markup, { incremental = false, focusedNode = null, shellSelector = ".home-shell" } = {}) {
  const source = container.ownerDocument.createElement("div");
  source.innerHTML = markup;
  const canUpdate = incremental && hasMountedKeyedDom(container, shellSelector);
  if (canUpdate) {
    updateChildren(container, source, focusedNode);
  } else {
    container.innerHTML = markup;
    remember(container, source);
  }
  mountedShells.set(container, container.querySelector(shellSelector));
  return Boolean(canUpdate);
}
