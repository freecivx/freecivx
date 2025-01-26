/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

public class Nation {

  private String name;
  private String adjective;
  private String graphicsStr;
  private String legend;

  // Constructor
  public Nation(String name, String adjective, String graphicsStr, String legend) {
    this.name = name;
    this.adjective = adjective;
    this.graphicsStr = graphicsStr;
    this.legend = legend;
  }

  // Getter for name
  public String getName() {
    return name;
  }

  // Setter for name
  public void setName(String name) {
    this.name = name;
  }

  public String getAdjective() {
    return adjective;
  }

  public void setAdjective(String adjective) {
    this.adjective = adjective;
  }

  // Getter for graphicsStr
  public String getGraphicsStr() {
    return graphicsStr;
  }

  // Setter for graphicsStr
  public void setGraphicsStr(String graphicsStr) {
    this.graphicsStr = graphicsStr;
  }

  // Getter for legend
  public String getLegend() {
    return legend;
  }

  // Setter for legend
  public void setLegend(String legend) {
    this.legend = legend;
  }

  // Override toString for easier debugging
  @Override
  public String toString() {
    return "Nation{"
        + "name='"
        + name
        + '\''
        + ", graphicsStr='"
        + graphicsStr
        + '\''
        + ", legend='"
        + legend
        + '\''
        + '}';
  }
}
