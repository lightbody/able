package net.lightbody.able.core.util;

public abstract class UnstoppableRunnable implements Runnable {
    private static final Log LOG = new Log();

    @Override
    public void run() {
        try {
            runSafely();
        } catch (Throwable t) {
            // TODO: Add thread name to Log class (take 'Thread.currentThread()' as the first arg)
            LOG.severe("%s: Encountered exception in an unstoppable runnable.", t, Thread.currentThread().getName());
        }
    }

    protected abstract void runSafely() throws Exception;
}
