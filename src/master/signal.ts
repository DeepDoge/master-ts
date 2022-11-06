import { randomId } from "./utils/id"

export type SignalListener<T> = (value?: T) => Promise<void> | void
export class Signal<T = any>
{
    public readonly id = randomId()
    private _listeners: SignalListener<T>[] = []
    constructor(
        public value: T
    ) {}

    subscribe(listener: SignalListener<T>)
    {
        this._listeners.push(listener)
        return {
            unsubscribe: () => {
                const index = this._listeners.indexOf(listener)
                if (index !== -1) this._listeners.splice(index, 1)
            }
        }
    }

    private static readonly empty = Symbol('empty')
    
    async signal(value: T | ((value: T) => T) | typeof Signal.empty = Signal.empty)
    {

        if (value !== Signal.empty) this.value = value instanceof Function ? value(this.value) : value    
        await Promise.all(this._listeners.map((listener) => listener(this.value)))
    }
}