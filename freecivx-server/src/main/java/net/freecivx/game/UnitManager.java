package net.freecivx.game;

import java.util.HashMap;
import java.util.Map;
import java.util.function.BiConsumer;

public class UnitManager {
    private Map<Long, Unit> units = new HashMap<>();

    public void put(long l, Unit unit) {
        units.put(l, unit);
    }

    public void foreach(BiConsumer<Long, Unit> f) {
        units.forEach((l, unit) -> f.accept(l, unit));
    }

    /**
     * Move a unit and update the store with the new value
     * @param unitId
     * @param destTile
     * @param dir
     * @return
     */
    public Unit moveAndUpdate(long unitId, int destTile, int dir) {
        var u = units.get(unitId);
        var out = new Unit(u.id(), u.owner(), destTile, u.type(), dir,
        u.veteran(), u.hp(), u.activity());
        units.put(unitId, out);
        return out;
    }
}
