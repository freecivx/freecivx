/**********************************************************************
 Freecivx - the 3D web version of Freeciv. http://www.freecivx.com/
 Copyright (C) 2009-2025  The Freeciv-web project, Andreas Røsdal

 This program is free software: you can redistribute it and/or modify
 it under the terms of the GNU Affero General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU Affero General Public License for more details.

 You should have received a copy of the GNU Affero General Public License
 along with this program.  If not, see <http://www.gnu.org/licenses/>.

 ***********************************************************************/

package net.freecivx.game;

/**
 * Minimal timer abstraction used by {@link Game} to schedule the per-turn
 * timeout.
 *
 * <p>Server builds inject a real implementation backed by a
 * {@link java.util.concurrent.ScheduledExecutorService}.
 */
public interface TurnTimer {

    /**
     * Schedules {@code task} to run after {@code delaySeconds} seconds.
     * Any previously scheduled (and not yet fired) task is cancelled first.
     *
     * @param task         the action to run when the delay expires
     * @param delaySeconds delay in seconds before running the task
     */
    void schedule(Runnable task, int delaySeconds);

    /**
     * Cancels any pending scheduled task.  Does nothing if no task is pending.
     */
    void cancel();
}
