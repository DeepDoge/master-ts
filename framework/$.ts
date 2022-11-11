import { signal, signalComputed, signalDerived, signalText } from "./signal"
import type { Signal, SignalListener, SignalSubscription, SignalSubscriptionOptions } from "./signal/base"
import type { SignalCompute } from "./signal/compute"

const mountUnmountObserver = new MutationObserver((mutations) => 
{
    for (const mutation of mutations)
    {
        Array.from(mutation.removedNodes).forEach(removedNode)
        Array.from(mutation.addedNodes).forEach(addedNode)
    }
})
mountUnmountObserver.observe(document, { childList: true, subtree: true })
const originalAttachShadow = Element.prototype.attachShadow
Element.prototype.attachShadow = function (options: ShadowRootInit)
{
    const shadowRoot = originalAttachShadow.call(this, options)
    if (options.mode === 'open') mountUnmountObserver.observe(shadowRoot, { childList: true, subtree: true })
    return shadowRoot
}

function addedNode(node: Master$Node)
{
    if (getRootNode(node) !== document) return
    node.$?.emitMount()
    Array.from(node.childNodes).forEach(addedNode)
    if (node instanceof HTMLElement) Array.from(node.shadowRoot?.childNodes ?? []).forEach(addedNode)
}

function removedNode(node: Master$Node)
{
    node.$?.emitUnmount()
    Array.from(node.childNodes).forEach(removedNode)
    if (node instanceof HTMLElement) Array.from(node.shadowRoot?.childNodes ?? []).forEach(removedNode)
}

function getRootNode(node: Node): null | Node
{
    if (node === document) return node
    if (node instanceof ShadowRoot) return getRootNode(node.host)
    if (node.parentNode) return getRootNode(node.parentNode)
    return null
}

export interface $$Listener
{
    (): void
}
export interface Master$Node extends Node
{
    $?: Master$
}

export function master$(node: Master$Node)
{
    return node.$ ?? new Master$(node)
}

export class Master$
{
    protected _mounted: boolean | null = null

    constructor(node: Master$Node)
    {
        if (node.$) throw new Error('Node already has tooling')
        node.$ = this

        this.onMount(() => console.log('%cmounted', 'color:red;font-weight:bold;font-size:12px', (node as Element).tagName || node.nodeValue || node.nodeName))
        this.onUnmount(() => console.log('%cunmounted', 'color:blue;font-weight:bold;font-size:12px', (node as Element).tagName || node.nodeValue || node.nodeName))
    }

    public emitMount()
    {
        if (this._mounted) return
        this._mounted = true
        this._mountListeners.forEach(listener => listener())
    }

    public emitUnmount()
    {
        if (!this._mounted) return
        this._mounted = false
        this._unmountListeners.forEach(listener => listener())
    }

    get mounted() { return !!this._mounted }

    protected readonly _mountListeners: $$Listener[] = []
    onMount<T extends $$Listener>(callback: T)
    {
        if (this._mounted) callback()
        else this._mountListeners.push(callback)
    }

    protected readonly _unmountListeners: $$Listener[] = []
    onUnmount(callback: $$Listener)
    {
        if (this._mounted === false) callback()
        else this._unmountListeners.push(callback)
    }

    signal<T>(value: T)
    {
        return signal(value)
    }

    subscribe<T>(signal: Signal<T>, callback: SignalListener<T>, options?: SignalSubscriptionOptions)
    {
        let subscription: SignalSubscription
        this.onMount(() => subscription = signal.subscribe(callback, options))
        this.onUnmount(() => subscription.unsubscribe())
    }

    compute<T>(compute: SignalCompute<T>, ...updaters: Signal[])
    {
        const computed = signalComputed(compute, ...updaters)
        this.onMount(() => computed.activate())
        this.onUnmount(() => computed.deactivate())
        return computed
    }

    derive<T, U>(signal: Signal<T>, derive: (value: T) => U)
    {
        const derived = signalDerived(signal, derive)
        this.onMount(() => derived.activate())
        this.onUnmount(() => derived.deactivate())
        return derived
    }

    text(parts: TemplateStringsArray, ...values: any[])
    {
        const text = signalText(parts, ...values)
        this.onMount(() => text.activate())
        this.onUnmount(() => text.deactivate())
        return text
    }

    await<T, P>(then: Promise<T>, placeholder: P)
    {
        let signal = this.signal<T | P>(placeholder)
        then.then(value => signal.set(value))
        return signal
    }

    interval(callback: () => void, interval: number)
    {
        let intervalId: number
        this.onMount(() => intervalId = setInterval(callback, interval))
        this.onUnmount(() => clearInterval(intervalId))
    }

    timeout(callback: () => void, timeout: number)
    {
        let timeoutId: number
        this.onMount(() => timeoutId = setTimeout(callback, timeout))
        this.onUnmount(() => clearTimeout(timeoutId))
    }
}