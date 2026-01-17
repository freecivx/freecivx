/*******************************************************************************
 * Freeciv-web - the web version of Freeciv. http://www.FreecivWorld.net/
 * Copyright (C) 2009-2017 The Freeciv-web project
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *******************************************************************************/
package org.freeciv.servlet;

import java.util.List;
import java.util.Map;

import org.freeciv.services.Statistics;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Lists: game type statisticts
 *
 * URL: /game/statistics/details
 */
@Controller
public class GameStatisticsDetails {

	@Autowired
	private Statistics statistics;

	@GetMapping("/game/statistics/details")
	public String getGameStatisticsDetails(Model model) {

		List<Map<String, Object>> result = statistics.getPlayedGamesByType();

		JSONArray data = new JSONArray();
		for (Map<String, Object> item : result) {
			data.put(new JSONObject(item));
		}

		try {
			model.addAttribute("data", data);
		} catch (RuntimeException e) {
			// Ohh well, we tried ...
		}

		return "game/statistics-details";

	}

}