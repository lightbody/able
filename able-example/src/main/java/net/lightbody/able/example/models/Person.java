package net.lightbody.able.example.models;

import net.lightbody.able.hibernate.GuiceEntityTuplizer;
import org.hibernate.annotations.Tuplizer;

import javax.persistence.Entity;
import javax.persistence.Id;

@Entity
@Tuplizer(impl = GuiceEntityTuplizer.class)
public class Person {
    @Id
    private Long id;
    private String name;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
