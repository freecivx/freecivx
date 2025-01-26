/* Copyright (C) The Authors 2025 */
package net.freecivx.game;

public class Government {

  private String name;
  private String ruleName;
  private String helptext;

  // Constructor
  public Government(String name, String ruleName, String helptext) {
    this.name = name;
    this.ruleName = ruleName;
    this.helptext = helptext;
  }

  // Getters
  public String getName() {
    return name;
  }

  public String getRuleName() {
    return ruleName;
  }

  public String getHelptext() {
    return helptext;
  }

  // Setters (if needed)
  public void setName(String name) {
    this.name = name;
  }

  public void setRuleName(String ruleName) {
    this.ruleName = ruleName;
  }

  public void setHelptext(String helptext) {
    this.helptext = helptext;
  }

  @Override
  public String toString() {
    return "Government{"
        + "name='"
        + name
        + '\''
        + ", ruleName='"
        + ruleName
        + '\''
        + ", helptext='"
        + helptext
        + '\''
        + '}';
  }
}
