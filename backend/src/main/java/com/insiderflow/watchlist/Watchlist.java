package com.insiderflow.watchlist;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.LinkedHashSet;
import java.util.Set;

/**
 * A user's followed members and tickers. One document per user (id == user id), so the whole
 * watchlist loads in a single read.
 */
@Document(collection = "watchlists")
public class Watchlist {

    @Id
    private String userId;

    private Set<String> members = new LinkedHashSet<>();
    private Set<String> tickers = new LinkedHashSet<>();

    public Watchlist() {
    }

    public Watchlist(String userId) {
        this.userId = userId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public Set<String> getMembers() {
        return members;
    }

    public void setMembers(Set<String> members) {
        this.members = members;
    }

    public Set<String> getTickers() {
        return tickers;
    }

    public void setTickers(Set<String> tickers) {
        this.tickers = tickers;
    }
}
