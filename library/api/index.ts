import type { Signal, SignalListener, SignalSubscription, SignalSubscriptionOptions } from "../signal/base"
import { SignalDerived } from "../signal/derived"
import { SignalSettable } from "../signal/settable"
import "./mutationObserver"

export interface NodeWithMasterAPI extends Node
{
    $masterAPI?: MasterAPI
}

export function injectOrGetMasterAPI(node: NodeWithMasterAPI)
{
    return node.$masterAPI ?? new MasterAPI(node)
}

export class MasterAPI
{
    protected _mounted: boolean | null = null
    protected _node: NodeWithMasterAPI
    get node() { return this._node }

    constructor(node: NodeWithMasterAPI)
    {
        if (node.$masterAPI) throw new Error('Node already has ')
        this._node = node
        node.$masterAPI = this

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

    protected readonly _mountListeners: Function[] = []
    onMount<T extends Function>(callback: T)
    {
        if (this._mounted) callback()
        else this._mountListeners.push(callback)
    }

    protected readonly _unmountListeners: Function[] = []
    onUnmount(callback: Function)
    {
        if (this._mounted === false) callback()
        else this._unmountListeners.push(callback)
    }

    signal<T>(...params: ConstructorParameters<typeof SignalSettable<T>>)
    {
        return new SignalSettable(...params)
    }

    subscribe<T>(signal: Signal<T>, callback: SignalListener<T>, options?: SignalSubscriptionOptions)
    {
        let subscription: SignalSubscription
        this.onMount(() => subscription = signal.subscribe(callback, options))
        this.onUnmount(() => subscription.unsubscribe())
    }

    derive<T>(...params: ConstructorParameters<typeof SignalDerived<T>>)
    {
        const computed = new SignalDerived(...params)
        this.onMount(() => computed.activate())
        this.onUnmount(() => computed.deactivate())
        return computed
    }

    await<T, P>(then: Promise<T>, placeholder: P)
    {
        const signal = this.signal<T | P>(placeholder)
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